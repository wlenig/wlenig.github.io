type Direction = "up" | "down" | "left" | "right";

interface Point {
    x: number;
    y: number;
}

interface Snake {
    body: Point[];
    direction: Direction;
    alive: boolean;
}

interface GameState {
    snakes: Snake[];
    foods: Point[];
    steps: number;
}

interface Agent {
    setup?: () => void;
    teardown?: () => void;
    getMove: (state: GameState, snake_idx: number) => Direction;
}