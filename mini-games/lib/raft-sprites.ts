import { publicAsset } from "./assets.ts";

export type RaftPose = "breathing" | "walking" | "attacking" | "taunting" | "hit";
export type RaftElement = "shadow" | "electric" | "fire" | "rock";

const RAFT_POSES: Record<RaftPose, { frameMs: number; loop: boolean }> = {
  breathing: { frameMs: 520, loop: true },
  walking: { frameMs: 140, loop: true },
  attacking: { frameMs: 110, loop: false },
  taunting: { frameMs: 220, loop: false },
  hit: { frameMs: 90, loop: true },
};

export const RAFT_SPRITES: Record<string, { strip: string; height: number; element: RaftElement; color: string }> = {
  gengar: { strip: publicAsset("/zepimon-web/raft-sprites/gengar.png"), height: 150, element: "shadow", color: "#be8cff" },
  pikachu: { strip: publicAsset("/zepimon-web/raft-sprites/pikachu.png"), height: 148, element: "electric", color: "#ffe579" },
  charizard: { strip: publicAsset("/zepimon-web/raft-sprites/charizard.png"), height: 164, element: "fire", color: "#ffad64" },
  bidoof: { strip: publicAsset("/zepimon-web/raft-sprites/bidoof.png"), height: 142, element: "rock", color: "#cfad82" },
};

export function raftSpriteFrame(pose: RaftPose, elapsed: number, reducedMotion: boolean, side: 0 | 1): { row: number; column: number } {
  const animation = RAFT_POSES[pose];
  const frame = Math.max(0, Math.floor(elapsed / animation.frameMs));
  // Trail Defense strips are south, north, west, east; Raft uses the inward-facing west/east pairs.
  const facing = side === 0 ? 6 : 4;
  const step = reducedMotion ? 0 : animation.loop ? frame % 2 : Math.min(1, frame);
  return { row: 0, column: facing + step };
}

export type RaftPortraitPose = { x: number; y: number; rotation: number; scaleX: number; scaleY: number; opacity: number; saturation: number };

/** Grounded poses for the Trail Defense walking strips. */
export function raftPortraitPose(pose: RaftPose, elapsed: number, reducedMotion: boolean, knockedOut = false): RaftPortraitPose {
  const rest: RaftPortraitPose = { x: 0, y: 0, rotation: 0, scaleX: 1, scaleY: 1, opacity: 1, saturation: 1 };
  const time = Math.max(0, Number.isFinite(elapsed) ? elapsed : 0);
  if (knockedOut) {
    const settle = reducedMotion ? 1 : 1 - (1 - Math.min(1, time / 650)) ** 3;
    return { ...rest, x: -9 + settle * 2, y: settle * 5, rotation: -0.13 - settle * 0.07, scaleX: 1.04 + settle * 0.04, scaleY: 0.92 - settle * 0.06, opacity: 1 - settle * 0.38, saturation: 0.35 - settle * 0.05 };
  }
  if (reducedMotion) {
    if (pose === "attacking") return { ...rest, rotation: 0.07, scaleY: 1.02 };
    if (pose === "taunting") return { ...rest, rotation: -0.06, scaleX: 1.03 };
    if (pose === "hit") return { ...rest, rotation: -0.08, scaleY: 0.94, saturation: 0.6 };
    return rest;
  }
  if (pose === "breathing") {
    const breath = Math.sin(time / 440);
    return { ...rest, scaleX: 1 - breath * 0.012, scaleY: 1 + breath * 0.02 };
  }
  if (pose === "walking") {
    const step = Math.sin(time / 95);
    const settle = Math.min(1, time / 110, Math.max(0, (900 - time) / 150));
    return { ...rest, x: step * 5 * settle, y: -Math.abs(step) * 3 * settle, rotation: step * 0.045 * settle, scaleY: 1 - Math.abs(step) * 0.02 * settle };
  }
  if (pose === "attacking") {
    if (time < 160) {
      const windup = time / 160;
      return { ...rest, x: -windup * 7, rotation: -windup * 0.1, scaleX: 1 + windup * 0.025, scaleY: 1 - windup * 0.045 };
    }
    if (time < 250) {
      const launch = 1 - (1 - (time - 160) / 90) ** 3;
      return { ...rest, x: -7 + launch * 18, rotation: -0.1 + launch * 0.22, scaleX: 1.025 - launch * 0.05, scaleY: 0.955 + launch * 0.085 };
    }
    const release = Math.max(0, 1 - (time - 250) / 400) ** 2;
    return { ...rest, x: release * 11, rotation: release * 0.12, scaleX: 1 - release * 0.025, scaleY: 1 + release * 0.04 };
  }
  if (pose === "taunting") {
    const envelope = Math.sin(Math.min(1, time / 1200) * Math.PI);
    const bounce = Math.sin(time / 95);
    return { ...rest, x: -3 * envelope, y: -Math.max(0, bounce) * 5 * envelope, rotation: -0.1 * envelope + bounce * 0.025 * envelope, scaleX: 1 + 0.05 * envelope, scaleY: 1 - 0.035 * envelope + bounce * 0.018 * envelope };
  }
  const recoil = Math.max(0, 1 - time / 650);
  return { ...rest, x: (-9 + Math.sin(time / 27) * 3) * recoil, y: -Math.sin(Math.min(1, time / 650) * Math.PI) * 3, rotation: -0.13 * recoil, scaleX: 1 + recoil * 0.04, scaleY: 1 - recoil * 0.08, saturation: 1 - recoil * 0.65 };
}
