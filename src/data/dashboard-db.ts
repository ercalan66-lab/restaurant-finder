import type { SupabaseClient } from '@supabase/supabase-js';
import { createContext, useContext } from 'react';

import { supabase } from '../../lib/supabase';

/**
 * The connection the restaurant editing screens (menu, photos, details, location) save through:
 * the owner's own sign-in by default, or the admin console's when an admin sets up a restaurant.
 */
export const DashboardDbContext = createContext<SupabaseClient>(supabase);

export const useDashboardDb = () => useContext(DashboardDbContext);
