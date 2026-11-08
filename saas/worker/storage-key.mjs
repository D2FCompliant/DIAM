// Original filenames belong in metadata; object keys must remain opaque ASCII.
export function storageObjectName(originalName,identifier=crypto.randomUUID()) {
  if(!/^[a-f0-9-]{36}$/i.test(identifier))throw new Error('Identifiant de stockage invalide.');
  const extension=String(originalName||'').match(/\.([a-z0-9]{1,12})$/i)?.[1].toLowerCase();
  return identifier+(extension?'.'+extension:'');
}
