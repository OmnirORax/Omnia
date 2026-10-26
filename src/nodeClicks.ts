/** Keep double-click expansion separate from single-click options. */
export function nodeClicks(
  single: (id: string) => void,
  double: (id: string) => void,
  delay = 320,
  select: (id: string) => void = () => {},
) {
  let pending: { id: string; timer: ReturnType<typeof setTimeout> } | null = null;
  function cancel() {
    if (pending) clearTimeout(pending.timer);
    pending = null;
  }
  return {
    click(id: string) {
      if (pending?.id === id) {
        cancel();
        select(id);
        double(id);
        return;
      }
      if (pending) {
        const previous = pending.id;
        cancel();
        single(previous);
      }
      select(id);
      pending = {
        id,
        timer: setTimeout(() => {
          pending = null;
          single(id);
        }, delay),
      };
    },
    cancel,
  };
}
