export const PANEL_OPENED_EVENT = 'pm:panel-opened'

export function broadcastPanelOpened(panelId) {
  window.dispatchEvent(new CustomEvent(PANEL_OPENED_EVENT, { detail: { panelId } }))
}
