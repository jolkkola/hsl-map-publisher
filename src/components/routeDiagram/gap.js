import React from "react";

import DottedLine from "components/dottedLine";

import styles from "./gap.css";

const Gap = () => (
    <div className={styles.root}>
        <DottedLine
            color="#007AC9"
            width={2}
            spacing={5}
            count={5}
        />
    </div>
);

export default Gap;
