import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface Repository {
  id: string;
  github_repo_id: number;
  full_name: string;
  local_path: string;
  default_branch: string;
}

interface RepositoryState {
  selectedRepo: Repository | null;
  connectedRepos: Repository[];

  // Actions
  setSelectedRepo: (repo: Repository | null) => void;
  setConnectedRepos: (repos: Repository[]) => void;
  addConnectedRepo: (repo: Repository) => void;
  removeConnectedRepo: (repoId: string) => void;
}

export const useRepositoryStore = create<RepositoryState>()(
  persist(
    (set) => ({
      selectedRepo: null,
      connectedRepos: [],

      setSelectedRepo: (repo) => set({ selectedRepo: repo }),

      setConnectedRepos: (repos) => set({ connectedRepos: repos }),

      addConnectedRepo: (repo) =>
        set((state) => ({
          connectedRepos: [...state.connectedRepos, repo],
        })),

      removeConnectedRepo: (repoId) =>
        set((state) => ({
          connectedRepos: state.connectedRepos.filter((r) => r.id !== repoId),
          selectedRepo:
            state.selectedRepo?.id === repoId ? null : state.selectedRepo,
        })),
    }),
    {
      name: 'ai-admin-repository',
    }
  )
);
