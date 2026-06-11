export function useUpload() {
  async function uploadImage(file: File, prefix: string): Promise<string> {
    const fd = new FormData();
    fd.append('file', file);
    const res = await useApi()<{ url: string }>(
      `/admin/uploads/image?prefix=${prefix}`,
      { method: 'POST', body: fd },
    );
    return res.url;
  }
  return { uploadImage };
}
