import { Router, type IRouter } from "express";

const router: IRouter = Router();

const DISCORD_CLIENT_ID = process.env.DISCORD_CLIENT_ID;
const DISCORD_CLIENT_SECRET = process.env.DISCORD_CLIENT_SECRET;
const DISCORD_GUILD_ID = process.env.DISCORD_GUILD_ID;
const DISCORD_BOT_TOKEN = process.env.DISCORD_BOT_TOKEN;
const REDIRECT_URI = process.env.NODE_ENV === 'production' 
  ? 'https://nhlsnipes.com/api/auth/discord/callback'
  : 'http://localhost:3001/api/auth/discord/callback';

// Step 1: Redirect user to Discord OAuth
router.get("/login", (_req, res) => {
  if (!DISCORD_CLIENT_ID) {
    res.status(500).json({ error: "Discord OAuth not configured" });
    return;
  }

  const params = new URLSearchParams({
    client_id: DISCORD_CLIENT_ID,
    redirect_uri: REDIRECT_URI,
    response_type: "code",
    scope: "identify guilds.join",
  });

  res.redirect(`https://discord.com/api/oauth2/authorize?${params}`);
});

// Step 2: Handle Discord callback and add user to server
router.get("/callback", async (req, res) => {
  const code = req.query.code as string;

  if (!code) {
    res.redirect("/?discord=error");
    return;
  }

  if (!DISCORD_CLIENT_ID || !DISCORD_CLIENT_SECRET || !DISCORD_GUILD_ID || !DISCORD_BOT_TOKEN) {
    res.status(500).json({ error: "Discord credentials not configured" });
    return;
  }

  try {
    // Exchange code for access token
    const tokenResponse = await fetch("https://discord.com/api/oauth2/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: DISCORD_CLIENT_ID,
        client_secret: DISCORD_CLIENT_SECRET,
        grant_type: "authorization_code",
        code,
        redirect_uri: REDIRECT_URI,
      }),
    });

    if (!tokenResponse.ok) {
      console.error("Discord token exchange failed:", await tokenResponse.text());
      res.redirect("/?discord=error");
      return;
    }

    const tokenData: any = await tokenResponse.json();
    const accessToken = tokenData.access_token;

    // Get user info
    const userResponse = await fetch("https://discord.com/api/users/@me", {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!userResponse.ok) {
      console.error("Discord user fetch failed");
      res.redirect("/?discord=error");
      return;
    }

    const userData: any = await userResponse.json();
    const userId = userData.id;

    // Add user to guild
    console.log(`Attempting to add user ${userId} to guild ${DISCORD_GUILD_ID}`);
    const addMemberResponse = await fetch(
      `https://discord.com/api/guilds/${DISCORD_GUILD_ID}/members/${userId}`,
      {
        method: "PUT",
        headers: {
          Authorization: `Bot ${DISCORD_BOT_TOKEN}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ access_token: accessToken }),
      }
    );

    console.log(`Add member response status: ${addMemberResponse.status}`);
    
    if (!addMemberResponse.ok) {
      const errorText = await addMemberResponse.text();
      console.error("Failed to add user to guild:", addMemberResponse.status, errorText);
      // User might already be in server - that's okay
      if (addMemberResponse.status === 204 || errorText.includes("already")) {
        console.log("User already in server");
        res.redirect("/?discord=already_joined");
        return;
      }
      res.redirect(`/?discord=error&code=${addMemberResponse.status}`);
      return;
    }

    // Success!
    console.log("Successfully added user to guild");
    res.redirect("/?discord=success");
  } catch (error) {
    console.error("Discord OAuth error:", error);
    res.redirect("/?discord=error");
  }
});

export default router;
