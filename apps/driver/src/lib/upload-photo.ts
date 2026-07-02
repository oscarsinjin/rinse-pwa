import * as ImagePicker from 'expo-image-picker';

import { supabase } from './supabase';

/** Opens the camera, uploads the photo to the public `proof-photos` bucket, and returns its URL. */
export async function captureAndUploadPhoto(pathPrefix: string): Promise<string | null> {
  const permission = await ImagePicker.requestCameraPermissionsAsync();
  if (permission.status !== 'granted') return null;

  const result = await ImagePicker.launchCameraAsync({ quality: 0.6 });
  if (result.canceled) return null;

  const asset = result.assets[0];
  const response = await fetch(asset.uri);
  const blob = await response.blob();
  const path = `${pathPrefix}-${Date.now()}.jpg`;

  const { error } = await supabase.storage.from('proof-photos').upload(path, blob, { contentType: 'image/jpeg' });
  if (error) throw error;

  const { data } = supabase.storage.from('proof-photos').getPublicUrl(path);
  return data.publicUrl;
}
