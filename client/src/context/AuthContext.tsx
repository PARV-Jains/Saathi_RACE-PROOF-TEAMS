import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import {
  User,
  Team,
  TeamMember,
  JoinRequest,
  InviteCode,
  DemoPersona,
} from '../types';
import { fetchMe, fetchDemoUsers, setApiUserId, getApiUserId } from '../api';
import { useToast } from './ToastContext';

interface AuthContextType {
  currentUser: User | null;
  currentTeam: Team | null;
  teamMembers: TeamMember[];
  pendingRequests: JoinRequest[];
  activeInvites: InviteCode[];
  sentRequest: (JoinRequest & { team_name?: string }) | null;
  demoPersonas: DemoPersona[];
  isLoading: boolean;
  sseConnected: boolean;
  switchUser: (userId: string) => Promise<void>;
  refreshUserData: () => Promise<void>;
  refreshDemoPersonas: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [currentTeam, setCurrentTeam] = useState<Team | null>(null);
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [pendingRequests, setPendingRequests] = useState<JoinRequest[]>([]);
  const [activeInvites, setActiveInvites] = useState<InviteCode[]>([]);
  const [sentRequest, setSentRequest] = useState<(JoinRequest & { team_name?: string }) | null>(null);
  const [demoPersonas, setDemoPersonas] = useState<DemoPersona[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [sseConnected, setSseConnected] = useState(false);

  const { showToast } = useToast();

  const loadUserData = useCallback(async (userId?: string) => {
    try {
      if (userId) {
        setApiUserId(userId);
      }
      const [data, personas] = await Promise.all([
        fetchMe(),
        fetchDemoUsers().catch(() => null),
      ]);
      setCurrentUser(data.user);
      setCurrentTeam(data.team);
      setTeamMembers(data.members || []);
      setPendingRequests(data.pendingRequests || []);
      setActiveInvites(data.activeInvites || []);
      setSentRequest(data.sentRequest || null);
      if (personas && Array.isArray(personas) && personas.length > 0) {
        setDemoPersonas(personas);
      }
    } catch (err: any) {
      console.warn('Could not load user data:', err);
    }
  }, []);

  const refreshDemoPersonas = useCallback(async () => {
    try {
      const personas = await fetchDemoUsers();
      if (personas && Array.isArray(personas) && personas.length > 0) {
        setDemoPersonas(personas);
      }
    } catch (err) {
      console.warn('Failed to refresh demo personas:', err);
    }
  }, []);

  const switchUser = useCallback(
    async (userId: string) => {
      setIsLoading(true);
      setApiUserId(userId);
      try {
        const [data, personas] = await Promise.all([
          fetchMe(),
          fetchDemoUsers().catch(() => null),
        ]);
        setCurrentUser(data.user);
        setCurrentTeam(data.team);
        setTeamMembers(data.members || []);
        setPendingRequests(data.pendingRequests || []);
        setActiveInvites(data.activeInvites || []);
        setSentRequest(data.sentRequest || null);
        if (personas && Array.isArray(personas) && personas.length > 0) {
          setDemoPersonas(personas);
        }
        const activeP = (personas || demoPersonas).find((p) => p.id === userId);
        const dynamicCategory = !data.team
          ? 'Solo Hacker'
          : data.team.leader_id === userId
            ? 'Team Leader'
            : 'Team Member';
        if (activeP) {
          showToast({
            type: 'info',
            title: `Switched Persona to ${activeP.name}`,
            message: `Role: ${dynamicCategory} · Ready to test operations under this identity.`,
          });
        }
      } catch (err: any) {
        console.warn('Could not switch user:', err);
      } finally {
        setIsLoading(false);
      }
    },
    [demoPersonas, showToast]
  );


  useEffect(() => {
    async function init() {
      setIsLoading(true);
      try {
        const personas = await fetchDemoUsers();
        setDemoPersonas(personas);

        const storedId = getApiUserId();
        const initialUserId =
          personas.find((p) => p.id === storedId)?.id ||
          personas[0]?.id ||
          '';

        if (initialUserId) {
          await loadUserData(initialUserId);
        }
      } catch (err) {
        console.error('Failed to initialize demo personas:', err);
      } finally {
        setIsLoading(false);
      }
    }

    init();
  }, [loadUserData]);


  useEffect(() => {
    let eventSource: EventSource | null = null;
    let reconnectTimeout: any = null;

    function connectSSE() {
      eventSource = new EventSource('/api/events');

      eventSource.onopen = () => {
        setSseConnected(true);
      };

      eventSource.addEventListener('connected', () => {
        setSseConnected(true);
      });

      eventSource.addEventListener('team:created', () => {
        loadUserData();
      });

      eventSource.addEventListener('team:member_joined', () => {
        loadUserData();
      });

      eventSource.addEventListener('team:member_left', () => {
        loadUserData();
      });

      eventSource.addEventListener('team:deleted', () => {
        loadUserData();
      });

      eventSource.addEventListener('team:member_removed', () => {
        loadUserData();
      });

      eventSource.addEventListener('request:submitted', () => {
        loadUserData();
      });

      eventSource.addEventListener('request:responded', () => {
        loadUserData();
      });

      eventSource.onerror = () => {
        setSseConnected(false);
        eventSource?.close();
        reconnectTimeout = setTimeout(connectSSE, 3000);
      };
    }

    connectSSE();

    return () => {
      eventSource?.close();
      clearTimeout(reconnectTimeout);
    };
  }, [loadUserData]);

  return (
    <AuthContext.Provider
      value={{
        currentUser,
        currentTeam,
        teamMembers,
        pendingRequests,
        activeInvites,
        sentRequest,
        demoPersonas,
        isLoading,
        sseConnected,
        switchUser,
        refreshUserData: loadUserData,
        refreshDemoPersonas,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}

