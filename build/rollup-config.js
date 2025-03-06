// Config file for running Rollup in "normal" mode (non-watch)
import terser from "@rollup/plugin-terser";

const production = process.env.MODE !== "dev";

const banner = `/* @preserve
 * Leaflet.markercluster
 * Provides Beautiful Animated Marker Clustering functionality for Leaflet, a JS library for interactive maps.
 * https://github.com/Leaflet/Leaflet.markercluster
 * (c) 2012-2017, Dave Leaver, smartrak
 */`;

export default {
  input: "src/index.js",
  output: [
    {
      banner,
      file: "dist/leaflet.markercluster.js",
      format: "es",
      name: "Leaflet.markercluster",
      sourcemap: true,
    },
    {
      banner,
      file: "dist/leaflet.markercluster.min.js",
      format: "es",
      name: "Leaflet.markercluster",
      sourcemap: true,
      plugins: [
        production &&
          terser({
            ecma: 2021,
            module: true,
            warnings: true,
            mangle: {
              properties: {
                regex: /^__/,
              },
            },
          }),
      ],
    },
  ],
};
