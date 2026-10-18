import * as Blockly from "blockly/core";

/** Apply trackpad input once per paint, retaining movement smaller than a pixel. */
export function attachWorkspaceScrolling(workspace, element) {
  let frame = null;
  let idleTimer = null;
  let pendingX = 0;
  let pendingY = 0;

  function cancel() {
    if (frame !== null) cancelAnimationFrame(frame);
    clearTimeout(idleTimer);
    frame = idleTimer = null;
    pendingX = pendingY = 0;
  }

  function flush() {
    frame = null;
    if (Blockly.Gesture.inProgress() || workspace.isDragging()) {
      cancel();
      return;
    }
    const x = workspace.scrollX - pendingX;
    const y = workspace.scrollY - pendingY;
    workspace.scroll(x, y, false);
    // Blockly rounds its scroll coordinates. Carry the fraction into the next
    // frame, but discard overscroll at the edge so reversing stays responsive.
    pendingX = Math.abs(workspace.scrollX - x) < 1 ? workspace.scrollX - x : 0;
    pendingY = Math.abs(workspace.scrollY - y) < 1 ? workspace.scrollY - y : 0;
  }

  function onWheel(event) {
    // Preserve browser zoom gestures; workspace zoom is disabled.
    if (event.ctrlKey || event.metaKey) return;
    event.preventDefault();
    event.stopPropagation();
    if (Blockly.Gesture.inProgress() || workspace.isDragging()) {
      cancel();
      return;
    }
    const delta = Blockly.browserEvents.getScrollDeltaPixels(event);
    if (event.shiftKey && !delta.x) pendingX += delta.y;
    else {
      pendingX += delta.x;
      pendingY += delta.y;
    }
    // Close editors once per scroll gesture instead of on every wheel tick.
    if (idleTimer === null) workspace.hideChaff(true);
    clearTimeout(idleTimer);
    idleTimer = setTimeout(() => { idleTimer = null; }, 150);
    if (frame === null) frame = requestAnimationFrame(flush);
  }

  element.addEventListener("wheel", onWheel, { passive: false, capture: true });
  element.addEventListener("pointerdown", cancel, true);
  return () => {
    cancel();
    element.removeEventListener("wheel", onWheel, true);
    element.removeEventListener("pointerdown", cancel, true);
  };
}
