"use client";

import { useEffect } from "react";
import { feedHref, gameIdFromStoryPath } from "../lib/gamePicker";

const BASE = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

/** On the 404 page: an unbuilt /games/<id>/ URL goes to the play feed for that game. Runs after hydration and renders nothing, so it can't cause a hydration mismatch. */
export function GameFeedRedirect() {
  useEffect(() => {
    const id = gameIdFromStoryPath(window.location.pathname);
    if (id) window.location.replace(feedHref(id, BASE));
  }, []);
  return null;
}
