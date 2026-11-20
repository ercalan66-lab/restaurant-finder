import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';

import { supabase } from '../../lib/supabase';
import type { PopularDish } from './food-sections';

type Row = { restaurant_id: number; dish_name: string; times_ordered: number };

/** Dishes ordered most in the last 30 days, most ordered first. Never throws: on any problem, none. */
export async function fetchPopularDishes(days = 30): Promise<PopularDish[]> {
  const { data, error } = await supabase.rpc('popular_dishes', { p_days: days });
  if (error || !data) return [];
  return (data as Row[]).map((row) => ({ restaurantId: row.restaurant_id, dishName: row.dish_name, timesOrdered: row.times_ordered }));
}

/** Reloads whenever the screen gains focus, so new orders show up when people come back. */
export function usePopularDishes() {
  const [popular, setPopular] = useState<PopularDish[]>([]);
  useFocusEffect(useCallback(() => {
    let active = true;
    void fetchPopularDishes().then((result) => { if (active) setPopular(result); });
    return () => { active = false; };
  }, []));
  return popular;
}
