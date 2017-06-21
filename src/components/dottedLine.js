import React from "react";
import PropTypes from "prop-types";

const Dot = props => (
    <svg width={props.width} height={props.height}>
        <circle
            cx={props.width / 2}
            cy={props.height / 2}
            r={props.radius}
            fill={props.color}
        />
    </svg>
);

Dot.propTypes = {
    color: PropTypes.string.isRequired,
    width: PropTypes.number.isRequired,
    height: PropTypes.number.isRequired,
    radius: PropTypes.number.isRequired,
};

const DottedLine = (props) => {
    const dots = [];
    for (let i = 0; i < props.count; i++) {
        dots.push(
            <Dot
                key={i}
                width={props.isHorizontal ? props.spacing : props.width}
                height={props.isHorizontal ? props.width : props.spacing}
                radius={props.width / 2}
                color={props.color}
            />
        );
    }

    const style = {
        display: "flex",
        flexFlow: props.isHorizontal ? "row" : "column",
        marginTop: -props.spacing / 2,
        marginBottom: -props.spacing / 2,
    };

    return (
        <div style={style}>
            {dots}
        </div>
    );
};

DottedLine.defaultProps = {
    isHorizontal: false,
};

DottedLine.propTypes = {
    color: PropTypes.string.isRequired,
    width: PropTypes.number.isRequired,
    spacing: PropTypes.number.isRequired,
    count: PropTypes.number.isRequired,
    isHorizontal: PropTypes.bool,
};

export default DottedLine;
