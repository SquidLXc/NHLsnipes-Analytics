import { Router, type IRouter, type Response } from "express";
import { getDraftKingsDeepLinks, getGenericDraftKingsURL } from "../providers/deeplinks";

const router: IRouter = Router();

interface SelectionRequest {
  playerName: string;
  market: string;
  line: number | null;
  team: string;
  opponent: string;
}

interface DeepLinkRequest {
  selections: SelectionRequest[];
}

/**
 * POST /api/deeplinks/draftkings
 * Get DraftKings deep links for a list of selections
 * This is an isolated endpoint - does not affect existing functionality
 */
router.post("/draftkings", async (req, res) => {
  try {
    const body = req.body as DeepLinkRequest;

    if (!body.selections || !Array.isArray(body.selections)) {
      res.status(400).json({
        error: "Invalid request body",
        code: "INVALID_REQUEST",
        message: "selections array is required",
      });
      return;
    }

    console.log(`=== DraftKings Deep Links API Call ===`);
    console.log(`Selections: ${body.selections.length}`);

    const result = await getDraftKingsDeepLinks(body.selections);

    // If we got deep links, return them
    if (result.deepLinks.desktop) {
      res.json(result);
      return;
    }

    // If no deep links available, return generic URL with explanation
    res.json({
      deepLinks: {
        desktop: getGenericDraftKingsURL(),
        ios: null,
        android: null,
      },
      matched: 0,
      unmatched: body.selections.length,
      errors: result.errors,
      fallback: true,
      message: "Deep links not available - using generic DraftKings URL",
    });
  } catch (error) {
    console.error("Deep links endpoint error:", error);
    const message = error instanceof Error ? error.message : "Deep links request failed";

    // Always return a fallback URL on error
    res.status(200).json({
      deepLinks: {
        desktop: getGenericDraftKingsURL(),
        ios: null,
        android: null,
      },
      matched: 0,
      unmatched: req.body?.selections?.length || 0,
      errors: [message],
      fallback: true,
      message: "Deep links request failed - using generic DraftKings URL",
    });
  }
});

export default router;
