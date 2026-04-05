import { useState, useEffect } from 'react';
import Purchases from 'react-native-purchases';
import { supabase } from '../lib/supabase';

export function usePremium() {
  const [isPremium, setIsPremium] = useState(false);
  const [isFemale, setIsFemale] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkAccess();
  }, []);

  const checkAccess = async () => {
    try {
      const [{ data: { user } }, customerInfo] = await Promise.all([
        supabase.auth.getUser(),
        Purchases.getCustomerInfo(),
      ]);

      if (user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('gender')
          .eq('id', user.id)
          .single();
        const female = profile?.gender === 'Woman' || profile?.gender === 'Female';
        setIsFemale(female);
      }

      setIsPremium(!!customerInfo.entitlements.active['premium']);
    } catch (e) {
      setIsPremium(false);
      setIsFemale(false);
    } finally {
      setLoading(false);
    }
  };

  // hasAccess = true if user is premium OR female
  const hasAccess = isPremium || isFemale;

  return { isPremium, isFemale, hasAccess, loading, refresh: checkAccess };
}
