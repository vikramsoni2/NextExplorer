// tooltip.directive.js
export default {
  mounted(el, binding) {
    // Create a unique popover ID
    const popoverId = `v-tooltip-${Math.random().toString(36).substr(2, 9)}`;

    // Set anchor identifiers on trigger element (button/icon)
    const anchorName = `--tooltip-anchor-${popoverId}`;
    el.style.anchorName = anchorName;
    el.style.setProperty('--tooltip-anchor', anchorName);
    el.setAttribute('aria-describedby', popoverId);

    // Create the popover tooltip element
    const popover = document.createElement('div');
    popover.setAttribute('id', popoverId);
    popover.setAttribute('popover', '');
    popover.setAttribute('role', 'tooltip');
    popover.style.positionAnchor = anchorName;
    popover.style.setProperty('--tooltip-anchor', anchorName);
    popover.className = 'v-tooltip-popover';
    popover.textContent = binding.value;

    // Insert popover after the trigger element
    el.parentNode.insertBefore(popover, el.nextSibling);

    // Show/hide popover on mouse/focus events
    const show = () => {
      if (typeof popover.showPopover === 'function') {
        popover.showPopover();
      }
    };
    const hide = () => {
      if (typeof popover.hidePopover === 'function') {
        popover.hidePopover();
      }
    };

    el.addEventListener('mouseenter', show);
    el.addEventListener('focus', show);
    el.addEventListener('mouseleave', hide);
    el.addEventListener('blur', hide);

    // Store ref for cleanup
    el._popover = popover;
    el._showTooltip = show;
    el._hideTooltip = hide;
  },
  unmounted(el) {
    // Cleanup listeners and popover
    el.removeEventListener('mouseenter', el._showTooltip);
    el.removeEventListener('focus', el._showTooltip);
    el.removeEventListener('mouseleave', el._hideTooltip);
    el.removeEventListener('blur', el._hideTooltip);
    if (el._popover) el._popover.remove();
    delete el._popover;
    delete el._showTooltip;
    delete el._hideTooltip;
  }
};
