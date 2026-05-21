import NetInfo from "@react-native-community/netinfo";
import { useCallback, useEffect, useState } from "react";

type NetworkStatus = {
  isChecking: boolean;
  isOnline: boolean;
  refresh: () => Promise<void>;
};

const hasInternetConnection = (state: {
  isConnected: boolean | null;
  isInternetReachable: boolean | null;
}) => state.isConnected !== false && state.isInternetReachable !== false;

export function useNetworkStatus(): NetworkStatus {
  const [isChecking, setIsChecking] = useState(true);
  const [isOnline, setIsOnline] = useState(true);

  const setStatus = useCallback((state: {
    isConnected: boolean | null;
    isInternetReachable: boolean | null;
  }) => {
    setIsOnline(hasInternetConnection(state));
    setIsChecking(false);
  }, []);

  const refresh = useCallback(async () => {
    setIsChecking(true);

    try {
      setStatus(await NetInfo.refresh());
    } catch {
      setStatus({ isConnected: false, isInternetReachable: false });
    }
  }, [setStatus]);

  useEffect(() => {
    let mounted = true;

    NetInfo.fetch()
      .then((state) => {
        if (mounted) {
          setStatus(state);
        }
      })
      .catch(() => {
        if (mounted) {
          setStatus({ isConnected: false, isInternetReachable: false });
        }
      });

    const unsubscribe = NetInfo.addEventListener((state) => {
      if (mounted) {
        setStatus(state);
      }
    });

    return () => {
      mounted = false;
      unsubscribe();
    };
  }, [setStatus]);

  return { isChecking, isOnline, refresh };
}
