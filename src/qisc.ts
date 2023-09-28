import puppeteer from "puppeteer";
import logger from "./logger";
import chalk from "chalk";
import asTable from "as-table";

type Lecture = {
  name: string;
  grade: number;
  credits: number;
};

asTable.configure({
  maxTotalWidth: 80,
});

export async function qisc({ verbose }: { verbose?: boolean }) {
  const loginSubmitSelector =
    "#wrapper > div.divcontent > div.content_max_portal_qis > div > form > table > tbody > tr:nth-child(1) > td > table > tbody > tr:nth-child(1) > td:nth-child(3) > center > input";

  async function login() {
    logger.info(`Logging in as ${qisUser}`);
    await page.waitForSelector("#Benutzerkennung");
    await page.type("#Benutzerkennung", qisUser);
    await page.type("#pass", qisPassword);
    await page.click(loginSubmitSelector);
  }

  async function getLectureDetails(): Promise<Lecture[]> {
    return await page.$$eval(
      "#wrapper > div.divcontent > div.content > form > table:nth-child(5) > tbody > tr",
      (lectureRows) => {
        const lectureDetails: Lecture[] = [];

        for (const row of lectureRows) {
          const nameColSelector = row.querySelector("td:nth-child(2)");
          const gradeColSelector = row.querySelector("td:nth-child(7)");
          const creditsColSelector = row.querySelector("td:nth-child(10)");

          const isHeader =
            gradeColSelector &&
            gradeColSelector.childNodes &&
            gradeColSelector.childNodes.length > 1;

          if (!isHeader) continue;
          let gradeStr = gradeColSelector?.childNodes[0].textContent
            ?.trim()
            .replace(",", ".");

          if (gradeStr) {
            const grade = parseFloat(gradeStr);
            if (isNaN(grade)) {
              logger.warn(`Could not parse grade ${gradeStr}`);
              continue;
            }

            const name = nameColSelector?.textContent?.trim() || "";
            const credits = parseFloat(
              creditsColSelector?.textContent?.trim() || ""
            );
            lectureDetails.push({ name, grade, credits });
          }
        }

        return lectureDetails;
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

  const lectureDetails = await getLectureDetails();
  let data: string = "";

  if (verbose) {
    data = asTable(
      lectureDetails.map(({ name, grade, credits }) => {
        return {
          name,
          grade: chalk.bgGreen.black(` ${grade.toFixed(2)} `),
          ects: chalk.bgGreen.black(`  ${credits} `),
        };
      })
    );
    logger.info("Lecture details:");
  }

  const averageGrade =
    lectureDetails.map((l) => l.grade).reduce((a, b) => a + b, 0) /
    lectureDetails.length;

  const averageGradeText = chalk.bgGreen.black(` ${averageGrade.toFixed(2)} `);
  data.split("\n").forEach((line) => logger.info(line));
  logger.info(`Your grade average is ${averageGradeText}`);

  await browser.close();
}
