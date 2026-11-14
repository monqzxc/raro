const basePath = process.env.GAMES_BASE_PATH ?? "";

export function publicAsset(path: `/${string}`) {
  return `${basePath}${path}`;
}
