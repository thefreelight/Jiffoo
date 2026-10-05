const wait = document.getElementById('wait');
const retry = document.getElementById('retry');
if (wait && retry) {
  const deadline = Number(wait.dataset.deadline);
  const target = wait.dataset.target;
  const update = () => {
    const seconds = Math.max(0, Math.ceil((deadline - Date.now()) / 1000));
    wait.textContent = wait.dataset.template.replace('{seconds}', String(seconds));
    if (retry instanceof HTMLButtonElement) retry.disabled = seconds > 0;
    if (seconds > 0) setTimeout(update, Math.min(1000, deadline - Date.now()));
  };
  retry.addEventListener('click', (event) => {
    if (Date.now() < deadline) { event.preventDefault(); return; }
    if (retry instanceof HTMLButtonElement && target) window.location.assign(target);
  });
  update();
}
