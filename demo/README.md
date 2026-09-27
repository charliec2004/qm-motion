# Field Notes target

This original FAQ fixture reproduces the real Radix Accordion close-animation
defect reported in [radix-ui/primitives#1074](https://github.com/radix-ui/primitives/issues/1074).
It uses the unchanged affected `@radix-ui/react-accordion@0.1.5` package and
React/ReactDOM `18.0.0-rc.0`, matching the report. The app has ordinary height
animations and React's concurrent root. No line is deliberately corrupted and
no diagnosis or fix is built into the application.

Radix release source:
[`2107c0e488247972a06be4248e5c98875f8e8aaa`](https://github.com/radix-ui/primitives/tree/2107c0e488247972a06be4248e5c98875f8e8aaa).
That revision's accordion package declares version 0.1.5. The app consumes the
published npm package; the lockfile pins all resolved tarballs and their integrity.
`baseline.sha256` pins the starting app source. `LICENSE.radix` preserves the
upstream MIT notice; the original fixture is MIT under `LICENSE`. No CodeSandbox
or third-party reproduction source was copied.

The old Radix package's declared peer range predates React 18, so `.npmrc`
allows this exact historical combination. This is an isolated debugging target,
not a recommendation for new production dependencies.

From the repository root, use `npm run demo`. The app and Chromium run inside
the selected QM computer. Edit its retained `qm-motion-demo/current` workspace,
not this pinned fixture. Use `npm run demo -- reset` for a new pristine copy.
See [the demo plan](../docs/demo.md).

`check.mjs` is a narrow target-readiness probe: it records actual animation-frame
geometry around three closes and saves a settled screenshot. A geometry rebound
is evidence of the defect; this check does not implement QM Motion or deliver
images to a model. It uses the repository/runtime Playwright installation.
