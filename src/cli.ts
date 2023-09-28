import { configDotenv } from "dotenv";
import puppeteer from "puppeteer";
import logger from "./logger";
import chalk from "chalk";

configDotenv();

const loginSubmitSelector =
  "#wrapper > div.divcontent > div.content_max_portal_qis > div > form > table > tbody > tr:nth-child(1) > td > table > tbody > tr:nth-child(1) > td:nth-child(3) > center > input";

async function main() {
  async function login() {
    logger.info(`Logging in as ${qisUser}`);
    await page.waitForSelector("#Benutzerkennung");
    await page.type("#Benutzerkennung", qisUser);
    await page.type("#pass", qisPassword);
    await page.click(loginSubmitSelector);
  }

  async function getGrades() {
    return await page.$$eval(
      "#wrapper > div.divcontent > div.content > form > table:nth-child(5) > tbody > tr",
      (nodes) => {
        const grades: number[] = [];
        for (const node of nodes) {
          const colNode = node.querySelector("td:nth-child(7)");
          if (colNode && colNode.childNodes && colNode.childNodes.length > 1) {
            let content = colNode.childNodes[0].textContent
              ?.trim()
              .replace(",", ".");

            if (!content) continue;
            grades.push(parseFloat(content));
          }
        }

        return grades;
      }
    );
  }

  const qisUser = process.env.QIS_USER as string;
  const qisPassword = process.env.QIS_PASSWORD as string;

  if (!qisUser || !qisPassword) {
    logger.error("No crenetials provided.");
    process.exitCode = 1;
    return;
  }

  const browser = await puppeteer.launch({ headless: "new" });
  const [page] = await browser.pages();

  await page.goto("https://qis.fh-kiel.de/");
  await login();

  const linksToGrades = [
    "#makronavigation > ul > li:nth-child(3) > a",
    "#wrapper > div.divcontent > div.content_max_portal_qis > div > form > div > ul > li:nth-child(5) > a",
    "#wrapper > div.divcontent > div.content > form > ul > li > a.regular",
    "#wrapper > div.divcontent > div.content > form > ul > li > ul > li > a:nth-child(4)",
  ];

  for (let i = 0; i < linksToGrades.length; i++) {
    const link = linksToGrades[i];
    const next = linksToGrades[i + 1];
    await page.click(link);
    if (next) await page.waitForSelector(next);
  }

  const grades = await getGrades();

  const averageGrade = grades.reduce((a, b) => a + b, 0) / grades.length;
  const averageGradeText = chalk.bgGreen.black(` ${averageGrade.toFixed(2)} `);
  logger.info(`Your grade average is ${averageGradeText}`);

  await browser.close();
}

main();
