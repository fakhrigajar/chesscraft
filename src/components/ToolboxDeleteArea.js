import * as Blockly from 'blockly/core';

/** Let Blockly own deletion and its undo events, including a drag outside its SVG. */
export class ToolboxDeleteArea extends Blockly.DeleteArea {
  constructor(getElement, isDisabled) {
    super();
    this.getElement = getElement;
    this.isDisabled = isDisabled;
    this.highlightedElement = null;
  }

  getClientRect() {
    const element = this.getElement();
    if (!element || this.isDisabled()) return null;
    const rect = element.getBoundingClientRect();
    return rect.width && rect.height ? Blockly.utils.Rect.from(rect) : null;
  }

  wouldDelete(element) {
    const deletable = !this.isDisabled() && element.type === 'chess_move' && element.isDeletable();
    this.updateWouldDelete_(deletable);
    return deletable;
  }

  highlight() {
    const element = this.getElement();
    this.clearHighlight();
    if (this.wouldDelete_ && element) {
      element.classList.add('delete-drop-active');
      this.highlightedElement = element;
    }
  }

  clearHighlight() {
    this.highlightedElement?.classList.remove('delete-drop-active');
    this.highlightedElement = null;
  }

  onDragEnter() { this.highlight(); }
  onDragOver() {
    if (this.wouldDelete_ && !this.highlightedElement) this.highlight();
  }
  onDragExit() { this.clearHighlight(); }
  onDrop() { this.clearHighlight(); }
}
