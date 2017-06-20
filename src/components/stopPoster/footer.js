import React from "react";
import PropTypes from "prop-types";
import QrCode from "components/qrCode";
import { Image } from "components/util";

import footerIcon from "icons/footer.svg";

import styles from "./footer.css";

const Footer = (props) => {
    const feedbackUrl = `http://hsl.fi/pysakit/${props.shortId.replace(" ", "")}`;


    return (
        <div style={{ position: "relative" }}>
            <Image src={footerIcon} id="footerIcon"/>
            <div className={styles.shortCode}>
                {feedbackUrl}
            </div>
            <div className={styles.qrCode}>
                <QrCode url={feedbackUrl}/>
            </div>
        </div>
    );
};

Footer.propTypes = {
    shortId: PropTypes.string.isRequired,
};

export default Footer;
