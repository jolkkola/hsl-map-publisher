const fs = require("fs");
const fetch = require("node-fetch");
const csv = require("csv");

const tilesetsByKey = {
    "1:35000": "http://kartat.hsl.fi/tiles/20171208/35000/index.json",
    "1:25000": "http://kartat.hsl.fi/tiles/20171208/25000/index.json",
    "1:16000": "http://kartat.hsl.fi/tiles/20171204/16000/index.json",
};

// Export CSV file from Google Sheets to current directory
const filename = `${__dirname}/routemaps.csv`;

function fetchRows() {
    return new Promise((resolve, reject) => {
        fs.createReadStream(filename)
            .pipe(csv.parse({ delimiter: ",", columns: true }, (err, data) => {
                if (err) {
                    reject(err);
                    return;
                }
                resolve(data);
            }));
    });
}

fetchRows()
    .then((rows) => {
        rows.forEach((row, index) => {
            const type = row.Tyyppi;
            const title = row["Otsikko suomi"];
            const subtitle = row["Otsikko ruotsi"];
            const width = parseInt(row["Leveys (mm)"], 10);
            const height = parseInt(row["Korkeus (mm)"], 10);
            const legendTop = parseFloat(row["Legenda ylhäältä (mm)"]);
            const legendLeft = parseFloat(row["Legenda vasemmalta (mm)"]);
            const key = row.Mittakaava.replace(/\s/g, "");
            const scale = parseFloat(row.Skaalaus);
            const lon = parseFloat(row["Vasen yläkulma (X)"]);
            const lat = parseFloat(row["Vasen yläkulma (Y)"]);

            const props = {
                title,
                subtitle,
                width,
                height,
                lat,
                lon,
                scale,
                tileset: tilesetsByKey[key],
            };

            if (legendTop) props.legendTop = legendTop;
            if (legendLeft) props.legendLeft = legendLeft;

            console.log(JSON.stringify(props)); // eslint-disable-line no-console

            if (Object.values(props).some(value => !value)) {
                console.log("> SKIPPING"); // eslint-disable-line no-console
                return;
            }

            console.log("> GENERATING"); // eslint-disable-line no-console

            const body = {
                component: "RouteMap",
                filename: `${type.replace(/ä/g, "a").replace(/ö/g, "o").replace(/\s/g, "_")}_${width}x${height}_${key.replace("1:", "")}.pdf`,
                props: [props],
            };

            const options = {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(body),
            };

            fetch("http://localhost:5000/api/generate", options)
                .then(response => response.json())
                    .then(({ path }) => console.log(`${index} ${title} > ${path}`)) // eslint-disable-line
                    .catch(error => console.log(error)); // eslint-disable-line
        });
    })
    .catch((error) => {
        console.error(error); // eslint-disable-line no-console
    });
