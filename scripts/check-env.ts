import {loadEnvConfig} from "@next/env";
import {validateEnvironment} from "../lib/server/env";
loadEnvConfig(process.cwd());
try{validateEnvironment();process.stdout.write("Configuration READY\n")}catch(e){process.stderr.write((e as Error).message+"\n");process.exitCode=1;}
