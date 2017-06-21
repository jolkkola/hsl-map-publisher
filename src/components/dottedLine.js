import React from "react";
import PropTypes from "prop-types";

import styles from "./dottedLine.css";

const Dot = props => (
    <svg width={props.width} height={props.spacing}>
        <circle
            cx={props.width / 2}
            cy={props.spacing / 2}
            r={props.width / 2}
            fill={props.color}
        />
    </svg>
);

Dot.propTypes = {
    color: PropTypes.string.isRequired,
    width: PropTypes.number.isRequired,
    spacing: PropTypes.number.isRequired,
};

const DottedLine = (props) => {
    const dots = [];
    for (let i = 0; i < props.count; i++) {
        dots.push(<Dot key={i} {...props}/>);
    }

    const style = {
        marginTop: -props.spacing / 2,
        marginBottom: -props.spacing / 2,
    };

    return (
        <div className={styles.root} style={style}>
            {dots}
        </div>
    );
};

DottedLine.propTypes = {
    ...Dot.propTypes,
    count: PropTypes.number.isRequired,
};

export default DottedLine;
