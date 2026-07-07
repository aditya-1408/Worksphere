/**
 * LiveKit helper utilities for WorkSphere meeting video
 */

export interface LiveKitTokenResponse {
  token: string;
  wsUrl: string;
  roomName: string;
  identity: string;
  name: string;
}

export async function getLiveKitToken(meetingId: string): Promise<LiveKitTokenResponse | null> {
  try {
    const response = await fetch(`/api/meetings/${meetingId}/livekit-token`, {
      cache: "no-store",
    });

    if (!response.ok) {
      const error = await response.json();
      console.error("Failed to get LiveKit token:", error);
      return null;
    }

    return await response.json();
  } catch (error) {
    console.error("Error getting LiveKit token:", error);
    return null;
  }
}

export function isLiveKitConfigured(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_LIVEKIT_URL);
}
