export function verifyUploadImageIdentity(platformInspect, classicInspect, expectedDigest) {
  const reject = () => { throw new Error(`Upload storage Docker preflight failed: expected pgsty/minio linux/amd64 image with digest ${expectedDigest}.`); };
  const image = (inspect) => {
    if (!Array.isArray(inspect) || inspect.length !== 1 || !inspect[0] || typeof inspect[0] !== 'object' || Array.isArray(inspect[0])) reject();
    const value = inspect[0];
    if (value.Os !== 'linux' || value.Architecture !== 'amd64') reject();
    return value;
  };
  if (platformInspect !== undefined) {
    const value = image(platformInspect);
    if (Object.hasOwn(value, 'Descriptor')) {
      if (!value.Descriptor || typeof value.Descriptor !== 'object' || Array.isArray(value.Descriptor) || value.Descriptor.digest !== expectedDigest) reject();
      return 'Descriptor';
    }
  }
  const value = image(classicInspect);
  if (!Array.isArray(value.RepoDigests) || value.RepoDigests.some(digest => typeof digest !== 'string') || !value.RepoDigests.includes(`pgsty/minio@${expectedDigest}`)) reject();
  return 'RepoDigests';
}
