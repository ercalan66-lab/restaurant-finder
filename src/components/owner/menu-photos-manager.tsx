import type { Restaurant } from '@/data/restaurants';
import { t } from '@/i18n';

import { Section } from './form-controls';
import { PhotoStrip } from './photo-strip';

/** Matches the database limit in 202611260001_menu_photos.sql. */
export const MAX_MENU_PHOTOS = 8;

/** Photos of the printed menu, one per page: the quickest way for an owner to put a menu online. */
export function MenuPhotosManager({ onUpdated, restaurant }: { onUpdated: (changes: Partial<Pick<Restaurant, 'menuPhotoUrls'>>) => void; restaurant: Restaurant }) {
  return <Section helper={t('menuPhotos.helper')} title={t('menuPhotos.title')}>
    <PhotoStrip addLabel={t('menuPhotos.add')} field="menuPhotoUrls" folder="menu-pages" max={MAX_MENU_PHOTOS} onUpdated={onUpdated} removeBody={t('menuPhotos.removeBody')} removeTitle={t('menuPhotos.removeTitle')} restaurant={restaurant} shape="upright" />
  </Section>;
}
