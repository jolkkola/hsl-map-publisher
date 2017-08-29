const fs = require("fs");
const groupBy = require("lodash/groupBy");
const fetch = require("node-fetch");
const moment = require("moment");
const csv = require("csv");

const GRAPHQL_URL = "http://kartat.hsl.fi/jore/graphql";
const API_URL = "http://kartat.hsl.fi/julkaisin/api/generate";

function fetchStopIds() {
    const options = {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: "query AllStops {allStops { nodes { shortId stopId }} }" }),
    };

    return fetch(GRAPHQL_URL, options)
        .then(response => response.json())
        .then(json => json.data.allStops.nodes);
}

function fetchRows() {
    return new Promise((resolve, reject) => {
        fs.createReadStream(`${__dirname}/posters.csv`)
            .pipe(csv.parse({ delimiter: ";", columns: true }, (err, data) => {
                if (err) {
                    reject(err);
                    return;
                }
                resolve(data);
            })
        );
    });
}

Promise.all([fetchStopIds(), fetchRows()])
    .then(([stopIds, rows]) => {
        const rowsByBuild = groupBy(rows, "Vastuu-urakoitsija");

        Object.keys(rowsByBuild).filter(key => !!key).forEach((key) => {
            const props = rowsByBuild[key].map(columns => ({
                stopId: stopIds.find(({ shortId }) => shortId.replace(/\s/g, "") === columns["Pysäkki"].replace(/\s/g, "")).stopId,
                date: moment(columns["Ajon poikkileikkauspäivä"]).format("YYYY-MM-DD", "DD/MM/YY"),
                dateBegin: moment(columns["Voimassaolokausi alkaa"]).format("YYYY-MM-DD", "DD/MM/YY"),
                dateEnd: moment(columns["Voimassaolokausi päättyy"]).format("YYYY-MM-DD", "DD/MM/YY"),
            }));

            const body = {
                component: "StopPoster",
                filename: `${key}.pdf`,
                props,
            };

            const options = {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(body),
            };

            fetch(API_URL, options)
                .then(response => response.json())
                .then(({ path }) => console.log(`${props.length} pages @ ${path}`)) // eslint-disable-line
                .catch(error => console.log(error)); // eslint-disable-line
        });
   })
    .catch((error) => {
        console.error(error); // eslint-disable-line no-console
    });
