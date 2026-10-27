import React, { useEffect, useState } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import {
  auth,
  collection,
  db,
  deleteDoc,
  doc,
  googleProvider,
  handleFirestoreError,
  onSnapshot,
  OperationType,
  query,
  serverTimestamp,
  setDoc,
  signInWithPopup,
  signOut,
  where,
} from './firebase';
import {
  PlanTier,
  ProjectStatus,
  SubscriptionData,
  VideoProjectData,
} from './types';
import {
  INITIAL_PROJECTS,
  INITIAL_SUBSCRIPTIONS,
  PLATFORM_METADATA,
} from './utils/seedData';
import { StudioWorkspace } from './components/StudioWorkspace';
import { UserDashboard } from './components/UserDashboard';
import { AdminPanel } from './components/AdminPanel';

export default function App() {
  const [currentView, setCurrentView] = useState<'studio' | 'dashboard' | 'admin'>(
    'studio'
  );
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  const [projects, setProjects] = useState<VideoProjectData[]>(INITIAL_PROJECTS);
  const [activeProjectId, setActiveProjectId] = useState<string>(
    INITIAL_PROJECTS[0].id
  );
  const [subscriptions, setSubscriptions] = useState<SubscriptionData[]>(
    INITIAL_SUBSCRIPTIONS
  );

  // Track Firebase Authentication state
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      setFirebaseUser(user);
      setIsAuthReady(true);

      if (user) {
        const userRef = doc(db, 'users', user.uid);
        try {
          await setDoc(
            userRef,
            {
              uid: user.uid,
              displayName: (user.displayName || 'Kreator VoxReel').slice(0, 80),
              photoURL: (user.photoURL || '').slice(0, 500),
              planTier: 'starter',
              projectsCount: projects.length,
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
            },
            { merge: true }
          );
        } catch {
          // Ignore if profile already exists with immutable createdAt
        }
      }
    });
    return () => unsub();
  }, []);

  // Attach Firestore listener for user's own projects when authenticated
  useEffect(() => {
    if (!isAuthReady || !firebaseUser) return;

    const q = query(
      collection(db, 'projects'),
      where('ownerId', '==', firebaseUser.uid)
    );

    const unsub = onSnapshot(
      q,
      (snapshot) => {
        if (snapshot.empty) return;
        const remoteProjects: VideoProjectData[] = [];
        snapshot.forEach((docSnap) => {
          const d = docSnap.data();
          remoteProjects.push({
            id: docSnap.id,
            ownerId: d.ownerId,
            authorName: d.authorName || firebaseUser.displayName || 'Kreator',
            title: d.title,
            topic: d.topic,
            platform: d.platform,
            aspectRatio: d.aspectRatio,
            voiceName: d.voiceName,
            visualStyle: d.visualStyle,
            language: d.language,
            status: d.status,
            totalDurationSec: d.totalDurationSec,
            scenesCount: d.scenesCount,
            hookText: d.hookText,
            createdAtIso: new Date().toISOString(),
            updatedAtIso: new Date().toISOString(),
            scenes: INITIAL_PROJECTS[0].scenes,
          });
        });

        if (remoteProjects.length > 0) {
          setProjects((prev) => {
            const existingIds = new Set(prev.map((p) => p.id));
            const merged = [...prev];
            for (const rp of remoteProjects) {
              if (!existingIds.has(rp.id)) {
                merged.unshift(rp);
              }
            }
            return merged;
          });
        }
      },
      (err) => {
        try {
          handleFirestoreError(err, OperationType.LIST, 'projects');
        } catch {
          // Handled structured log
        }
      }
    );

    return () => unsub();
  }, [isAuthReady, firebaseUser]);

  const activeProject =
    projects.find((p) => p.id === activeProjectId) || projects[0];

  const currentUserId = firebaseUser?.uid || 'creator_demo_01';
  const currentUserName = firebaseUser?.displayName || 'Anas Sutisna';

  const currentUserSubscription =
    subscriptions.find((s) => s.ownerId === currentUserId) || subscriptions[0];

  // Persist project to Firestore if user is signed in
  const syncProjectToFirestore = async (
    proj: VideoProjectData,
    isNew: boolean
  ) => {
    if (!firebaseUser) return;
    const projPath = `projects/${proj.id}`;
    try {
      const payload: Record<string, unknown> = {
        ownerId: firebaseUser.uid,
        authorName: (proj.authorName || firebaseUser.displayName || 'Kreator').slice(
          0,
          80
        ),
        title: proj.title.slice(0, 140),
        topic: proj.topic.slice(0, 500),
        platform: proj.platform,
        aspectRatio: proj.aspectRatio,
        voiceName: proj.voiceName,
        visualStyle: proj.visualStyle.slice(0, 60),
        language: proj.language,
        status: proj.status,
        totalDurationSec: Math.max(3, Math.min(1800, Math.round(proj.totalDurationSec))),
        scenesCount: Math.max(1, Math.min(30, proj.scenes.length)),
        hookText: (proj.hookText || proj.title).slice(0, 300),
        updatedAt: serverTimestamp(),
      };
      if (isNew) {
        payload.createdAt = serverTimestamp();
      }
      await setDoc(doc(db, 'projects', proj.id), payload, { merge: !isNew });
    } catch (err) {
      try {
        handleFirestoreError(
          err,
          isNew ? OperationType.CREATE : OperationType.UPDATE,
          projPath
        );
      } catch {
        // Logged structured Firestore error
      }
    }
  };

  const handleCreateProject = async (newProject: VideoProjectData) => {
    setProjects((prev) => [newProject, ...prev]);
    setActiveProjectId(newProject.id);
    setSubscriptions((prev) =>
      prev.map((s) =>
        s.id === currentUserSubscription.id
          ? { ...s, usedQuota: s.usedQuota + 1 }
          : s
      )
    );
    await syncProjectToFirestore(newProject, true);
  };

  const handleUpdateProject = async (updatedProject: VideoProjectData) => {
    setProjects((prev) =>
      prev.map((p) => (p.id === updatedProject.id ? updatedProject : p))
    );
    await syncProjectToFirestore(updatedProject, false);
  };

  const handleDeleteProject = async (projectId: string) => {
    setProjects((prev) => {
      const remaining = prev.filter((p) => p.id !== projectId);
      if (remaining.length === 0) {
        return INITIAL_PROJECTS;
      }
      if (activeProjectId === projectId) {
        setActiveProjectId(remaining[0].id);
      }
      return remaining;
    });

    if (firebaseUser) {
      try {
        await deleteDoc(doc(db, 'projects', projectId));
      } catch (err) {
        try {
          handleFirestoreError(err, OperationType.DELETE, `projects/${projectId}`);
        } catch {
          // Logged structured error
        }
      }
    }
  };

  const handleDuplicateProject = (project: VideoProjectData) => {
    const dupId = `proj_${Date.now()}`;
    const nowIso = new Date().toISOString();
    const duplicated: VideoProjectData = {
      ...project,
      id: dupId,
      title: `${project.title} (Salinan)`.slice(0, 140),
      status: 'draft',
      createdAtIso: nowIso,
      updatedAtIso: nowIso,
      scenes: project.scenes.map((sc, idx) => ({
        ...sc,
        id: `sc_${dupId}_${idx}`,
        projectId: dupId,
      })),
    };
    setProjects((prev) => [duplicated, ...prev]);
    setActiveProjectId(duplicated.id);
  };

  const handleUpgradeUserTier = (newTier: PlanTier) => {
    const tierPricing: Record<PlanTier, { quota: number; price: number }> = {
      starter: { quota: 10, price: 0 },
      creator_pro: { quota: 50, price: 249000 },
      agency_studio: { quota: 200, price: 699000 },
    };
    const spec = tierPricing[newTier];
    setSubscriptions((prev) =>
      prev.map((sub) =>
        sub.id === currentUserSubscription.id
          ? {
              ...sub,
              planTier: newTier,
              monthlyQuota: spec.quota,
              amountIdr: spec.price,
              status: 'active',
              updatedAtIso: new Date().toISOString(),
            }
          : sub
      )
    );
  };

  const handleGoogleAuth = async () => {
    setAuthError(null);
    if (firebaseUser) {
      await signOut(auth);
      return;
    }
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (err) {
      setAuthError(
        err instanceof Error
          ? err.message
          : 'Autentikasi Google dibatalkan atau gagal.'
      );
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900">
      {/* Strict 3-Zone Top Bar Contract */}
      <header className="flex items-center justify-between gap-8 px-6 py-4 bg-white border-b border-slate-200 sticky top-0 z-30">
        {/* Zone 1: Single text element wordmark */}
        <a
          href="#studio"
          onClick={(e) => {
            e.preventDefault();
            setCurrentView('studio');
          }}
          className="text-lg font-bold tracking-tight text-slate-900 whitespace-nowrap shrink-0"
        >
          VoxReel Studio
        </a>

        {/* Zone 2: 4 concise single-line text navigation links */}
        <nav
          aria-label="Navigasi Utama"
          className="flex items-center gap-6 text-sm font-medium text-slate-600 overflow-x-auto"
        >
          <a
            href="#studio"
            onClick={(e) => {
              e.preventDefault();
              setCurrentView('studio');
            }}
            className={`hover:text-slate-900 transition-colors whitespace-nowrap shrink-0 ${
              currentView === 'studio'
                ? 'text-slate-900 underline underline-offset-8 decoration-2 decoration-blue-600'
                : ''
            }`}
          >
            Studio Video
          </a>
          <a
            href="#dashboard"
            onClick={(e) => {
              e.preventDefault();
              setCurrentView('dashboard');
            }}
            className={`hover:text-slate-900 transition-colors whitespace-nowrap shrink-0 ${
              currentView === 'dashboard'
                ? 'text-slate-900 underline underline-offset-8 decoration-2 decoration-blue-600'
                : ''
            }`}
          >
            Dashboard Saya
          </a>
          <a
            href="#subscription-plans"
            onClick={(e) => {
              e.preventDefault();
              setCurrentView('dashboard');
              setTimeout(() => {
                document
                  .getElementById('subscription-plans')
                  ?.scrollIntoView({ behavior: 'smooth' });
              }, 60);
            }}
            className="hover:text-slate-900 transition-colors whitespace-nowrap shrink-0"
          >
            Paket Langganan
          </a>
          <a
            href="#admin"
            onClick={(e) => {
              e.preventDefault();
              setCurrentView('admin');
            }}
            className={`hover:text-slate-900 transition-colors whitespace-nowrap shrink-0 ${
              currentView === 'admin'
                ? 'text-slate-900 underline underline-offset-8 decoration-2 decoration-blue-600'
                : ''
            }`}
          >
            Panel Admin
          </a>
        </nav>

        {/* Zone 3: 1 primary action */}
        <div className="flex items-center gap-3 shrink-0">
          <button
            type="button"
            onClick={handleGoogleAuth}
            className="px-4 py-2 text-xs font-semibold text-white bg-slate-900 rounded-lg hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            {firebaseUser ? 'Keluar Akun' : 'Sinkronisasi Akun Google'}
          </button>
        </div>
      </header>

      {/* Secondary Workspace Context Bar below the fold */}
      <div className="bg-white border-b border-slate-200 px-6 py-2.5">
        <div className="max-w-[1440px] mx-auto flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-slate-600">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-medium text-slate-900">
              {currentView === 'studio'
                ? 'Ruang Produksi Otomatis'
                : currentView === 'dashboard'
                ? 'Dashboard Riwayat & Langganan Kreator'
                : 'Konsol Administrasi Platform'}
            </span>
            <span aria-hidden="true">·</span>
            <span>
              YouTube, Shorts, TikTok, Instagram Reels, Facebook Reels & Konten Marketing
            </span>
          </div>

          <div className="flex items-center gap-3">
            {currentView === 'studio' && (
              <div className="flex items-center gap-2">
                <label htmlFor="quick-project-switcher" className="text-slate-500">
                  Proyek Aktif:
                </label>
                <select
                  id="quick-project-switcher"
                  value={activeProject.id}
                  onChange={(e) => setActiveProjectId(e.target.value)}
                  className="px-2.5 py-1 text-xs font-medium text-slate-900 bg-slate-100 border border-slate-200 rounded-md max-w-[240px] truncate"
                >
                  {projects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.title} ({PLATFORM_METADATA[p.platform]?.shortLabel})
                    </option>
                  ))}
                </select>
              </div>
            )}

            <span className="text-slate-500">
              Kreator: <strong className="text-slate-800">{currentUserName}</strong>
            </span>
          </div>
        </div>
      </div>

      {authError && (
        <div className="max-w-[1440px] w-full mx-auto px-6 pt-3">
          <div className="bg-amber-50 border border-amber-200 text-amber-800 text-xs px-4 py-2 rounded-lg flex items-center justify-between">
            <span>{authError}</span>
            <button
              type="button"
              onClick={() => setAuthError(null)}
              className="underline font-medium ml-4 cursor-pointer"
            >
              Tutup
            </button>
          </div>
        </div>
      )}

      {/* Main Content Container */}
      <main className="flex-1 max-w-[1440px] w-full mx-auto px-6 py-6">
        {currentView === 'studio' && (
          <StudioWorkspace
            activeProject={activeProject}
            onCreateProject={handleCreateProject}
            onUpdateProject={handleUpdateProject}
            currentUserId={currentUserId}
            currentUserName={currentUserName}
          />
        )}

        {currentView === 'dashboard' && (
          <UserDashboard
            projects={projects}
            userSubscription={currentUserSubscription}
            onSelectProjectToEdit={(project) => {
              setActiveProjectId(project.id);
              setCurrentView('studio');
            }}
            onDuplicateProject={handleDuplicateProject}
            onDeleteProject={handleDeleteProject}
            onUpgradeTier={handleUpgradeUserTier}
            onNavigateToStudio={() => setCurrentView('studio')}
          />
        )}

        {currentView === 'admin' && (
          <AdminPanel
            allProjects={projects}
            allSubscriptions={subscriptions}
            onInspectProjectInStudio={(project) => {
              setActiveProjectId(project.id);
              setCurrentView('studio');
            }}
            onUpdateProjectStatus={(projectId, status: ProjectStatus) => {
              setProjects((prev) =>
                prev.map((p) =>
                  p.id === projectId
                    ? { ...p, status, updatedAtIso: new Date().toISOString() }
                    : p
                )
              );
            }}
            onAdminDeleteProject={handleDeleteProject}
            onUpdateSubscription={(updated) => {
              setSubscriptions((prev) =>
                prev.map((s) => (s.id === updated.id ? updated : s))
              );
            }}
            onAddSubscriber={(newSub) => {
              setSubscriptions((prev) => [newSub, ...prev]);
            }}
          />
        )}
      </main>

      {/* Clean Quiet Footer */}
      <footer className="bg-white border-t border-slate-200 px-6 py-4 mt-12">
        <div className="max-w-[1440px] mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-500">
          <span>
            VoxReel Studio — Otomatisasi Produksi Video Faceless untuk Kreator & Tim Marketing
          </span>
          <div className="flex items-center gap-4">
            <button
              type="button"
              onClick={() => setCurrentView('studio')}
              className="hover:text-slate-900 cursor-pointer"
            >
              Buka Studio Editor
            </button>
            <button
              type="button"
              onClick={() => setCurrentView('dashboard')}
              className="hover:text-slate-900 cursor-pointer"
            >
              Buka Riwayat Proyek
            </button>
            <button
              type="button"
              onClick={() => setCurrentView('admin')}
              className="hover:text-slate-900 cursor-pointer"
            >
              Buka Konsol Admin
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
}
