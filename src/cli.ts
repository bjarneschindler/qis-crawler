import { cli } from "cleye";
import { version } from "../package.json";
import { qisc } from "./qisc";
import { configDotenv } from "dotenv";

configDotenv();

cli(
  {
    name: "qisc",
    version,
    flags: {
      verbose: {
        type: Boolean,
        description: "Prints your grade for every course",
        alias: "v",
      },
    },
    ignoreArgv: (type) => type === "unknown-flag" || type === "argument",
  },
  (argv) => qisc({ verbose: argv.flags.verbose }),
  process.argv.slice(2)
);
