export const requiredAssetKeys = [
  "player",
  "enemyChaser",
  "enemyDrifter",
  "enemyOrbiter",
  "boss",
  "energyCore",
  "hazardMine",
  "riftBackground",
  "titleBadge",
  "warningIcon",
  "goalToken",
] as const;

export type AssetKey = (typeof requiredAssetKeys)[number];

export const assetManifest: Record<AssetKey, string> = {
  player: "/assets/player-drone.png",
  enemyChaser: "/assets/enemy-chaser.png",
  enemyDrifter: "/assets/enemy-drifter.png",
  enemyOrbiter: "/assets/enemy-orbiter.png",
  boss: "/assets/boss-machine.png",
  energyCore: "/assets/energy-core.png",
  hazardMine: "/assets/hazard-mine.png",
  riftBackground: "/assets/rift-background.png",
  titleBadge: "/assets/title-badge.png",
  warningIcon: "/assets/warning-icon.png",
  goalToken: "/assets/goal-token.png",
};

export type LoadedAssets = {
  images: Partial<Record<AssetKey, HTMLImageElement>>;
  missing: AssetKey[];
};

export const loadGameAssets = async (): Promise<LoadedAssets> => {
  const entries = await Promise.all(
    requiredAssetKeys.map(async (key) => {
      const image = new Image();
      image.decoding = "async";
      image.src = assetManifest[key];

      try {
        await image.decode();
        return [key, image] as const;
      } catch {
        return [key, null] as const;
      }
    }),
  );

  const images: Partial<Record<AssetKey, HTMLImageElement>> = {};
  const missing: AssetKey[] = [];
  for (const [key, image] of entries) {
    if (image) {
      images[key] = image;
    } else {
      missing.push(key);
    }
  }

  return { images, missing };
};
