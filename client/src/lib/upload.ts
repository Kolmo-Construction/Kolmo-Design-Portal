export async function uploadToR2(file: File): Promise<string> {
  const formData = new FormData();
  formData.append('image', file);
  formData.append('title', file.name);
  formData.append('category', 'design_proposal');

  const response = await fetch('/api/admin/images', {
    method: 'POST',
    body: formData,
    credentials: 'include',
  });

  if (!response.ok) {
    throw new Error('Failed to upload image');
  }

  const data = await response.json();
  return data.images[0].imageUrl;
}
