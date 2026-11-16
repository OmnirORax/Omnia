# Performance watchlist

User-requested features to revisit if performance becomes a problem. This is a
list of possible trade-offs, not confirmed bottlenecks or a plan to reduce
quality now. Add entries when the user asks. Measure the affected interaction
before relaxing a feature.

## Detailed content contours

**Status:** recent detailed-contour experiments were rolled back at the user's
request after visual and selection regressions. The earlier fixed 64-direction,
padded envelope, hit geometry and selection animation are restored. Keep this
entry as a future performance watch item if detailed contours are attempted again.

**Significance:** estimated low for small scenes; potentially moderate with
hundreds or thousands of visible labels. Not measured in a representative large
browser scene.

**Where the cost occurs:**

- Creating or changing labels scans a cached mask, capped at 256 pixels on its
  longest dimension, and builds contour geometry. The restored envelope uses
  64 directions; future detailed boundaries could increase the vertex count.
- First content-view activation or changing many labels together can concentrate
  this work into a noticeable pause. Later toggles can reuse cached contours.
- Visible contours add geometry memory and drawing work. Camera movement does
  not trigger new mask scans or contour geometry construction.
- Alignment and non-overlap updates can process more boundary data, even though
  collision separation remains convex.

**If this becomes a bottleneck, consider:**

1. Simplify the silhouette with a bounded error and vertex budget, preserving
   the intended appearance as closely as possible.
2. Use cheaper contours or hide fine outline detail for small/distant nodes;
   retain detail for focused nodes. Keep picking and separation consistent with
   the displayed boundary.
3. Lower mask resolution if content-change processing is the bottleneck.
4. Spread bulk contour creation across frames, with a temporary simple boundary.
5. As a larger visual compromise, use a simple bounding shape or the earlier
   fixed-direction envelopes.

**Check before changing:** first versus cached content-view toggles, bulk label
edits, alignment/non-overlap time, camera frame time, and memory at representative
visible-node counts. Distinguish contour costs from text rendering and the rest
of the scene. Browser interaction testing remains user-owned unless requested.
