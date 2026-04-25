import { useEffect, useState } from "react";

export function useOverflow(
  ref: { current: HTMLElement | null },
  watch: unknown
) {
  const [overflowing, setOverflowing] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    let frame = 0;
    const timers: number[] = [];
    const check = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        setOverflowing(el.scrollHeight > el.clientHeight + 1);
      });
    };

    check();

    const resizeObserver = new ResizeObserver(check);
    resizeObserver.observe(el);
    const mutationObserver = new MutationObserver(check);
    mutationObserver.observe(el, { childList: true, characterData: true, subtree: true });
    window.addEventListener("resize", check);

    timers.push(window.setTimeout(check, 80));
    timers.push(window.setTimeout(check, 240));
    timers.push(window.setTimeout(check, 600));
    timers.push(window.setTimeout(check, 1400));
    timers.push(window.setTimeout(check, 2400));

    return () => {
      cancelAnimationFrame(frame);
      timers.forEach((timer) => window.clearTimeout(timer));
      resizeObserver.disconnect();
      mutationObserver.disconnect();
      window.removeEventListener("resize", check);
    };
  }, [ref, watch]);

  return overflowing;
}

function fadeMask(showTopFade: boolean, showBottomFade: boolean) {
  if (showTopFade && showBottomFade) {
    return "linear-gradient(to bottom, transparent 0, black 28px, black calc(100% - 18px), transparent 100%)";
  }
  if (showTopFade) {
    return "linear-gradient(to bottom, transparent 0, black 28px, black 100%)";
  }
  if (showBottomFade) {
    return "linear-gradient(to bottom, black 0, black calc(100% - 18px), transparent 100%)";
  }
  return "none";
}

export function useScrollFade(
  ref: { current: HTMLElement | null },
  watch: unknown
) {
  const [state, setState] = useState({
    overflowing: false,
    showTopFade: false,
    showBottomFade: false,
    maskImage: "none",
  });

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    let frame = 0;
    const timers: number[] = [];

    const check = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const overflowing = el.scrollHeight > el.clientHeight + 1;
        const showTopFade = overflowing && el.scrollTop > 1;
        const showBottomFade = overflowing && el.scrollTop + el.clientHeight < el.scrollHeight - 1;
        setState({
          overflowing,
          showTopFade,
          showBottomFade,
          maskImage: fadeMask(showTopFade, showBottomFade),
        });
      });
    };

    check();

    const resizeObserver = new ResizeObserver(check);
    resizeObserver.observe(el);
    const mutationObserver = new MutationObserver(check);
    mutationObserver.observe(el, { childList: true, characterData: true, subtree: true });
    el.addEventListener("scroll", check, { passive: true });
    window.addEventListener("resize", check);

    timers.push(window.setTimeout(check, 80));
    timers.push(window.setTimeout(check, 240));
    timers.push(window.setTimeout(check, 600));
    timers.push(window.setTimeout(check, 1400));
    timers.push(window.setTimeout(check, 2400));

    return () => {
      cancelAnimationFrame(frame);
      timers.forEach((timer) => window.clearTimeout(timer));
      resizeObserver.disconnect();
      mutationObserver.disconnect();
      el.removeEventListener("scroll", check);
      window.removeEventListener("resize", check);
    };
  }, [ref, watch]);

  return state;
}
