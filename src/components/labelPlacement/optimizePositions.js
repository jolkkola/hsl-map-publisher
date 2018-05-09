import updatePosition from "./updatePosition";
import { getIfOccupied } from "../../util/MapAlphaChannelMatrix";

import {
    hasOverflow,
    getOverflowCost,
    getOverlapArea,
    getOverlapCost,
    getDistanceCost,
    getIntersectionCost,
    getFixedIntersectionCost,
    getAngleCost,
    getAlphaOverflowCost,
    shouldBeVisible,
    removedCost,
    // getPositionOverlapCost,
    // getPositionFixedIntersectionCost,
} from "./costFunctions";

const timeout = 4 * 24 * 60 * 60 * 1000;
const iterationsPerFactor = 10;

const angles = [-6, -4, -2, -1, 0, 1, 2, 4, 6];
const distances = [-4, -2, -1, 0, 1, 2, 4];
const factors = [30, 20, 10, 5, 2];

const diffsArray = factors.map(factor => (
    angles.reduce((prev, angle) => ([
        ...prev,
        ...distances.map(distance => ({ angle: angle * factor, distance: distance * factor })),
    ]), [])
));

function getCost(placement, bbox, alphaByteArray, configuration) {
    const { positions, indexes } = placement;

    const shouldItemBeVisible = position =>
        shouldBeVisible(position, alphaByteArray, bbox, configuration);

    const overflow = getOverflowCost(positions, indexes, bbox);
    const overlap = getOverlapCost(positions, indexes, shouldItemBeVisible);
    const distance = getDistanceCost(positions, indexes);
    const angle = getAngleCost(positions, indexes);
    const intersection = getIntersectionCost(positions, indexes);
    const intersectionWithFixed = getFixedIntersectionCost(positions, indexes);
    const alphaOverlap = getAlphaOverflowCost(positions, indexes, alphaByteArray);
    const removed = removedCost(positions, indexes, alphaByteArray, bbox, configuration);
    return overflow
        + overlap
        + distance
        + angle
        + intersection
        + intersectionWithFixed
        + alphaOverlap
        + removed;
}

function getOverlappingItem(placement, indexToOverlap) {
    const { positions } = placement;
    for (let i = 0; i < positions.length; i++) {
        if (i !== indexToOverlap && !positions[i].isFixed &&
            getOverlapArea(positions[i], positions[indexToOverlap]) > 0) {
            return i;
        }
    }
    return null;
}

function getPlacements(placement, index, diffs, bbox) {
    const { positions, indexes } = placement;

    return diffs
        .map((diff) => {
            const updatedPosition = updatePosition(positions[index], diff);
            if (
                !updatedPosition
                || (!positions[index].allowHidden && hasOverflow(updatedPosition, bbox))
                || (
                    positions[index].maxDistance
                    && (
                        positions[index].distance - positions[index].initialDistance
                    ) > positions[index].maxDistance)) {
                return null;
            }
            return positions.map((position, i) => ((i === index) ? updatedPosition : position));
        })
        .filter(updatedPositions => !!updatedPositions)
        .map(updatedPositions => ({ positions: updatedPositions, indexes: [...indexes, index] }));
}

function comparePlacements(placement, other, bbox, alphaByteArray, configuration) {
    const indexes = [...new Set([...placement.indexes, ...other.indexes])];
    const cost = getCost({ ...placement, indexes }, bbox, alphaByteArray, configuration);
    const costOther = getCost({ ...other, indexes }, bbox, alphaByteArray, configuration);
    return costOther < cost ? other : placement;
}

function getNextPlacement(initialPlacement, index, diffs, bbox, alphaByteArray, configuration) {
    // Get potential positions for item at index
    const placements = getPlacements({ ...initialPlacement, indexes: [] }, index, diffs, bbox);

    // Get positions where one overlapping item is updated as well
    const placementsOverlapping = placements.reduce((prev, placement) => {
        const overlapIndex = getOverlappingItem(placement, index);
        if (!overlapIndex) return prev;
        return [...prev, ...getPlacements(placement, overlapIndex, diffs, bbox)];
    }, []);

    const nextPlacement = [
        initialPlacement,
        ...placements,
        ...placementsOverlapping,
    ].reduce((prev, cur) => comparePlacements(prev, cur, bbox, alphaByteArray, configuration));

    return nextPlacement;
}

function findMostSuitablePosition(initialPlacement, bbox, isOccupied, configuration) {
    const start = Date.now();
    let placement = initialPlacement;
    const iter = factors.length * iterationsPerFactor * placement.positions.length;
    let counter = 0;
    for (let factor = 0; factor < factors.length; factor++) {
        const diffs = diffsArray[factor];
        for (let iteration = 0; iteration < iterationsPerFactor; iteration++) {
            console.log(`${counter}/${iter}`); // eslint-disable-line
            const previous = placement;
            for (let index = 0; index < placement.positions.length; index++) {
                counter++;
                if (!placement.positions[index].isFixed) {
                    placement =
                        getNextPlacement(placement, index, diffs, bbox, isOccupied, configuration);
                }
                if ((Date.now() - start) > timeout) {
                    console.log("Timeout"); // eslint-disable-line
                    return placement.positions;
                }
            }
            if (placement === previous) {
                break;
            }
        }
    }
    return placement.positions;
}

function optimizePositions(initialPositions, bbox, alphaByteArray, mapOptions, configuration) {
    const placement = {
        positions: initialPositions.map(position => updatePosition(position)),
        indexes: [],
    };

    const isOccupied = getIfOccupied(alphaByteArray, mapOptions);

    const positions = findMostSuitablePosition(placement, bbox, isOccupied, configuration);

    const newPlacements = [];
    positions.forEach((position, index) => { // eslint-disable-line 
        newPlacements.push({
            ...position,
            visible: shouldBeVisible(position, isOccupied, bbox, configuration),
        });
    });
    return newPlacements;
}

export default optimizePositions;
