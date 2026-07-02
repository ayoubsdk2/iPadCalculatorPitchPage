import sys

with open('src/components/calculator/store.ts', 'r') as f:
    content = f.read()

old_hook = """export function useCalc<T>(selector: (s: CalcState) => T): T {
  const isHydrated = useHydrated();
  return useSyncExternalStore(
    (cb) => calcStore.subscribe(cb),
    () => selector(isHydrated ? calcStore.get() : initialState),
    () => selector(initialState),
  );
}"""

new_hook = """export function useCalc<T>(selector: (s: CalcState) => T): [T, boolean] {
  const isHydrated = useHydrated();
  const state = useSyncExternalStore(
    (cb) => calcStore.subscribe(cb),
    () => selector(isHydrated ? calcStore.get() : initialState),
    () => selector(initialState),
  );
  return [state, isHydrated];
}"""

if old_hook in content:
    new_content = content.replace(old_hook, new_hook)
    with open('src/components/calculator/store.ts', 'w') as f:
        f.write(new_content)
    print("Updated useCalc successfully")
else:
    print("Could not find old_hook")
