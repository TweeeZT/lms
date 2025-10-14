import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabaseAdmin = createClient(url, serviceKey);

/**
 * Delete old files from Supabase storage bucket
 * @param bucket - Bucket name (e.g., 'assignments-submissions')
 * @param filePath - Full path to file (e.g., 'userId/filename.jpg')
 */
export async function deleteStorageFile(bucket: string, filePath: string) {
  try {
    const { error } = await supabaseAdmin.storage
      .from(bucket)
      .remove([filePath]);
    if (error) {
      console.error(`[Storage] Failed to delete ${filePath}:`, error);
      return false;
    }
    console.log(`[Storage] Deleted: ${filePath}`);
    return true;
  } catch (err) {
    console.error(`[Storage] Error deleting ${filePath}:`, err);
    return false;
  }
}

/**
 * Extract file path from Supabase storage URL
 * @param url - Full URL (e.g., 'https://xxx.supabase.co/storage/v1/object/public/bucket/path/file.jpg')
 * @returns File path or null
 */
export function extractStoragePath(url: string | null): string | null {
  if (!url) return null;
  try {
    const match = url.match(/\/storage\/v1\/object\/public\/[^/]+\/(.+)$/);
    return match ? match[1] : null;
  } catch {
    return null;
  }
}
