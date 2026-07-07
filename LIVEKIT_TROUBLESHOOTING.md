# LiveKit Video Troubleshooting Guide

## Quick Checklist

### ✅ Pre-Flight Checks (Before Testing)

1. **Vercel Deployment**
   - [ ] Latest commit `aba03f3` deployed successfully
   - [ ] No build errors in Vercel dashboard
   - [ ] Deployment status shows "Ready"

2. **Environment Variables in Vercel**
   ```
   NEXT_PUBLIC_LIVEKIT_URL=wss://worksphere-c58z7raq.livekit.cloud
   LIVEKIT_API_KEY=API3ELknDthfT6e
   LIVEKIT_API_SECRET=CmEqgcnmMh5c5Sv3RF3Yq6LiwLNo1j7A0nABW4QKLzI
   GEMINI_API_KEY=<your-key>
   DATABASE_URL=<neon-connection-string>
   SESSION_SECRET=<any-secret>
   DEMO_LOGIN_PASSWORD=AtomQuest@2026
   ```

3. **LiveKit Cloud Project**
   - [ ] Visit https://cloud.livekit.io/
   - [ ] Project `worksphere-c58z7raq` is active
   - [ ] API keys are not expired
   - [ ] Within free tier limits

---

## Common Issues & Solutions

### Issue 1: Debug Panel Shows All ❌ Marks

**Symptoms:**
- LiveKit Token: ❌ Missing
- LiveKit URL: ❌ Missing
- Room Name: ❌ Missing

**Possible Causes:**
1. Token API call failed
2. Environment variables not set in Vercel
3. LiveKit credentials invalid

**Solution Steps:**

**A. Check Browser Console (F12)**
```javascript
// Look for errors like:
"Failed to get LiveKit token: {error: 'LiveKit is not configured'}"
// OR
"GET /api/meetings/xxx/livekit-token 503 (Service Unavailable)"
```

**B. Check Network Tab (F12 → Network)**
1. Filter for "livekit-token"
2. Click on the request
3. Check Response:
   - **200 OK** → Good, should have {token, wsUrl, roomName}
   - **401 Unauthorized** → Authentication issue (session expired, login again)
   - **503 Service Unavailable** → Environment variables missing in Vercel
   - **404 Not Found** → Meeting doesn't exist or no access

**C. Verify Environment Variables**
1. Go to Vercel dashboard
2. Project Settings → Environment Variables
3. Ensure ALL three LiveKit variables are set
4. **CRITICAL**: `NEXT_PUBLIC_LIVEKIT_URL` must start with "NEXT_PUBLIC_" for client access
5. After adding/changing env vars, **redeploy** from Vercel dashboard

---

### Issue 2: Meeting Status Not "LIVE"

**Symptoms:**
- Debug panel shows: Meeting LIVE: ❌
- "Start Meeting" button not visible or doesn't work

**Solution:**
1. Only **Manager** can start meetings
2. Must be logged in as: `manager@worksphere.demo` / `AtomQuest@2026`
3. Click "🎬 Start Meeting" button
4. Wait 2-3 seconds for status to update
5. Page should refresh automatically showing "Meeting is LIVE"

---

### Issue 3: User Not "Joined"

**Symptoms:**
- Debug panel shows: User Joined: ❌
- Meeting is LIVE but video doesn't appear

**Solution:**
1. Click "✅ Join Meeting" button
2. Wait for page refresh
3. Should see "You joined" message
4. Debug panel should update to: User Joined: ✅

---

### Issue 4: Token Loads But Video Doesn't Render

**Symptoms:**
- All debug checkmarks show ✅
- Can Show Video: ✅ YES
- But no video interface appears

**Possible Causes:**
1. LiveKit React components failed to load
2. Browser blocks WebRTC
3. LiveKit server unreachable

**Solution Steps:**

**A. Check Console for LiveKit Errors**
```javascript
// Look for:
"Failed to connect to LiveKit room"
"WebRTC connection failed"
"ICE connection failed"
```

**B. Check Browser Permissions**
1. Browser should ask for camera/microphone permission
2. Click "Allow" when prompted
3. If denied, go to browser settings → Site permissions → Reset permissions

**C. Test Different Browser**
- Try Chrome/Edge (best WebRTC support)
- Avoid older browsers
- Disable browser extensions (ad blockers can interfere)

**D. Check Firewall/Network**
- LiveKit uses WebRTC (UDP ports)
- Some corporate firewalls block WebRTC
- Try from different network (mobile hotspot)

---

### Issue 5: "🔄 Manually Load Video Token" Button Appears

**Symptoms:**
- Meeting LIVE ✅, User Joined ✅
- But token still ❌ Missing
- Manual load button visible

**Solution:**
1. Click the "🔄 Manually Load Video Token" button
2. Open Console (F12) to see what error occurs
3. Common errors:
   - **401**: Session expired → Logout and login again
   - **503**: LiveKit not configured → Check Vercel env vars
   - **Network error**: Deployment issue → Check Vercel logs

---

### Issue 6: LiveKit API Keys Invalid

**Symptoms:**
- Token API returns 503 or 500 error
- Console shows "Invalid API key" or similar

**Solution:**

**Regenerate LiveKit API Keys:**
1. Go to https://cloud.livekit.io/
2. Login to your account
3. Go to your project "worksphere-c58z7raq"
4. Settings → API Keys
5. Create new API key pair
6. Copy API Key and API Secret
7. Update in Vercel:
   ```
   LIVEKIT_API_KEY=<new-key>
   LIVEKIT_API_SECRET=<new-secret>
   ```
8. **Redeploy** from Vercel dashboard

---

### Issue 7: Video Works Locally But Not on Vercel

**Symptoms:**
- `npm run dev` works fine with video
- Deployed version on Vercel doesn't work

**Possible Causes:**
1. Environment variables not set in Vercel
2. Different DATABASE_URL (local vs production)
3. Meeting created locally doesn't exist in production database

**Solution:**
1. **Never test local meetings on production** - they don't exist in Vercel's database
2. Create NEW meeting on deployed site
3. Verify all env vars in Vercel match local `.env` (except DATABASE_URL)

---

## Testing Procedure (Step-by-Step)

### Test 1: Manager Creates and Starts Meeting

```
1. Open deployed URL in Chrome
2. Login: manager@worksphere.demo / AtomQuest@2026
3. Click "Meetings" in navigation
4. Click "+ Schedule Meeting"
5. Fill in:
   - Title: "Test Video Meeting"
   - Date: <today's date + 30 minutes>
   - Agenda: "Testing LiveKit integration"
   - Participants: ✅ Priya Shah (u-employee)
6. Click "Create Meeting"
7. Find "Test Video Meeting" in list
8. Click "🎬 Start Meeting"
9. Verify: Status changes to "LIVE 🔴"
10. Click "✅ Join Meeting"
11. Check Debug Panel:
    - Meeting LIVE: ✅
    - User Joined: ✅
    - LiveKit Token: ✅
    - LiveKit URL: ✅
    - Room Name: ✅
    - Can Show Video: ✅ YES
12. Video interface should appear with:
    - Video preview (your camera)
    - Mute/Unmute button
    - Camera On/Off button
    - Screen Share button
    - Leave button
```

### Test 2: Employee Joins Meeting

```
1. Open deployed URL in INCOGNITO/PRIVATE window
2. Login: employee@worksphere.demo / AtomQuest@2026
3. Click "Meetings"
4. Find "Test Video Meeting" (should show "LIVE 🔴")
5. Click "✅ Join Meeting"
6. Check Debug Panel (should all be ✅)
7. Video interface should appear
8. You should see Manager's video in the room
```

---

## Debug Commands

### Check if Meeting Exists in Database

Run in Vercel PostgreSQL (Neon):
```sql
SELECT id, title, status, "livekitRoomName", "hostId"
FROM "Meeting"
WHERE title LIKE '%Test%'
ORDER BY "createdAt" DESC
LIMIT 5;
```

### Check Participant Status

```sql
SELECT m.title, mp.status, u.name, mp."joinedAt"
FROM "MeetingParticipant" mp
JOIN "Meeting" m ON m.id = mp."meetingId"
JOIN "User" u ON u.id = mp."userId"
WHERE m.title LIKE '%Test%'
ORDER BY mp."createdAt" DESC;
```

### Verify LiveKit Room Name Generated

```sql
SELECT id, "livekitRoomName"
FROM "Meeting"
WHERE "livekitRoomName" IS NOT NULL
LIMIT 5;
```

---

## API Endpoints to Test Manually

### 1. Get LiveKit Token
```bash
# After joining meeting, test token endpoint
curl https://your-app.vercel.app/api/meetings/<meeting-id>/livekit-token \
  -H "Cookie: <copy from browser dev tools>"
```

**Expected Response:**
```json
{
  "token": "eyJhbGc...",
  "wsUrl": "wss://worksphere-c58z7raq.livekit.cloud",
  "roomName": "room_xxx",
  "identity": "u-manager",
  "name": "Rohan Mehta"
}
```

### 2. Get Meeting Status
```bash
curl https://your-app.vercel.app/api/meetings/<meeting-id>/status \
  -H "Cookie: <copy from browser>"
```

**Expected Response:**
```json
{
  "meeting": {
    "status": "LIVE",
    "participants": [...]
  }
}
```

---

## Still Not Working?

### Last Resort Debugging

**Enable Detailed Logging:**

Add to `src/app/page.tsx` (temporarily):

```typescript
// In loadLiveKitToken function
const loadLiveKitToken = async (meetingId: string) => {
  console.log("🎬 loadLiveKitToken START", { meetingId });
  setIsLoadingVideo(true);
  setVideoError(null);

  try {
    const response = await fetch(`/api/meetings/${meetingId}/livekit-token`, {
      cache: "no-store",
    });

    console.log("🎬 Token API Response Status:", response.status);
    
    if (!response.ok) {
      const error = await response.json();
      console.error("🎬 Token API Error:", error);
      throw new Error(error.error ?? "Failed to get video token");
    }

    const data = await response.json();
    console.log("🎬 Token Data Received:", {
      hasToken: !!data.token,
      wsUrl: data.wsUrl,
      roomName: data.roomName,
    });

    setLivekitToken(data.token);
    setLivekitWsUrl(data.wsUrl);
    setLivekitRoomName(data.roomName);
    console.log("🎬 State Updated Successfully");
  } catch (error) {
    console.error("🎬 loadLiveKitToken ERROR:", error);
    setVideoError(error instanceof Error ? error.message : "Failed to load video");
  } finally {
    setIsLoadingVideo(false);
    console.log("🎬 loadLiveKitToken END");
  }
};
```

Then test and share ALL console output.

---

## Contact Points

If still stuck after trying everything above, provide:

1. ✅ Screenshot of Debug Panel
2. ✅ Browser Console logs (all red errors)
3. ✅ Network tab showing livekit-token request/response
4. ✅ Vercel deployment logs (Functions tab → meeting token API)
5. ✅ Confirmation that all env vars are set in Vercel
6. ✅ Confirmation that LiveKit project is active

This will help diagnose the exact issue quickly.
