import { useCallback, useEffect, useRef, useState } from "react";


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


const BOARD_SIZE = 20;
const CELL_SIZE = 20;
const BOARD_WIDTH = BOARD_SIZE * CELL_SIZE;
const BOARD_HEIGHT = BOARD_SIZE * CELL_SIZE;
const STEP_INTERVAL = 200;
const STARTING_LENGTH = 3;


class CircleAgent implements Agent {
    getMove(state: GameState, snake_idx: number): Direction {
        switch (Math.floor(state.steps / 5) % 4) {
            case 0:
                return "up";
            case 1:
                return "right";
            case 2:
                return "down";
            case 3:
                return "left";
            default:
                return state.snakes[snake_idx].direction;
        } 
    }
}


class RandomAgent implements Agent {
    getMove(state: GameState, snake_idx: number): Direction {
        const directions: Direction[] = ["up", "down", "left", "right"];
        const randomIndex = Math.floor(Math.random() * directions.length);
        return directions[randomIndex];
    }
}


class SimpleAgent implements Agent {
    getMove(state: GameState, snake_idx: number): Direction {
        const snake = state.snakes[snake_idx];
        const head = snake.body[0];

        // find the closest food
        let closestFood: Point | null = null;
        let closestDistance = Infinity;

        for (const food of state.foods) {
            const distance = Math.abs(head.x - food.x) + Math.abs(head.y - food.y);
            if (distance < closestDistance) {
                closestDistance = distance;
                closestFood = food;
            }
        }

        if (!closestFood) return snake.direction;

        // move towards the closest food
        let wish: Direction | null = null;
        if (head.x < closestFood.x) wish = "right";
        if (head.x > closestFood.x) wish = "left";
        if (head.y < closestFood.y) wish = "down";
        if (head.y > closestFood.y) wish = "up";

        // check if the move is a 180
        const opposites = {
            up: "down",
            down: "up",
            left: "right",
            right: "left",
        }

        // if the move is a 180, turn away from the nearest wall
        if (wish === opposites[snake.direction]) {
            if (wish == "up" || wish == "down") {
                if (head.x < BOARD_SIZE / 2) {
                    wish = "right";
                } else {
                    wish = "left";
                }
            } else {
                if (head.y < BOARD_SIZE / 2) {
                    wish = "down";
                } else {
                    wish = "up";
                }
            }
        }

        return wish || snake.direction;
    }
}


class KeyboardAgent implements Agent {
    private nextMoves: Direction[] = [];

    private handleKeydown = (event: KeyboardEvent) => {
        let wish: Direction | null = null;

        switch (event.key) {
            case "ArrowUp":
                wish = "up";
                break;
            case "ArrowDown":
                wish = "down";
                break;
            case "ArrowLeft":
                wish = "left";
                break;
            case "ArrowRight":
                wish = "right";
                break;       
        }

        if (wish) {
            this.nextMoves.push(wish);
        }
    };

    setup() {
        window.addEventListener("keydown", this.handleKeydown);
    }

    teardown() {
        window.removeEventListener("keydown", this.handleKeydown);
    }

    getMove(state: GameState, snake_idx: number): Direction {
        if (this.nextMoves.length > 0) {
            const move = this.nextMoves.shift();
            if (move) {
                return move;
            }
        }

        // default to the current direction
        return state.snakes[snake_idx].direction;
    }
}


export default function SnakeGame(
    { agents }: { agents: Agent[] }
) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [gameState, setGameState] = useState<GameState>({ snakes: [], foods: [], steps: 0 });

    // setup game on load
    useEffect(setupGame, []);

    // setup step to be called
    useEffect(() => {
        const interval = setInterval(() => {
            setGameState((prevState) => step(prevState));
        }, STEP_INTERVAL);
        return () => clearInterval(interval);
    }, []);

    // redraw on every game state change
    useEffect(() => {
        draw();
    }, [gameState]);

    function setupGame() {
        // setup agents
        if (agents.length === 0) {
            console.warn("No agents provided, using default agent");
            agents.push(new KeyboardAgent());
            agents.push(new CircleAgent());
            agents.push(new RandomAgent());
            agents.push(new SimpleAgent());
        }

        agents.forEach((agent) => {
            agent.setup && agent.setup();
        });

        const initialSnakes: Snake[] = agents.map((_, index) => ({
            body: Array.from({ length: STARTING_LENGTH }, (_, i) => ({
                x: Math.floor(BOARD_SIZE / (agents.length + 1)) * (index + 1),
                y: Math.floor(BOARD_SIZE / 2),
            })),
            direction: "up",
            alive: true,
        }))

        // place food randomly on the board
        const initialFoods = Array.from({ length: 5 }, () => getNextFoodPosition(initialSnakes));

        setGameState({
            snakes: initialSnakes,
            foods: initialFoods,
            steps: 0,
        });

        // return cleanup function
        return () => {
            agents.forEach((agent) => {
                agent.teardown && agent.teardown();
            });
        }
    }
    
    function step(state: GameState): GameState {
        const newFoods = [...state.foods];

        // update snakes
        const newSnakes = state.snakes.map((snake, index) => {
            // do not update dead snakes
            if (!snake.alive) return snake;

            const newSnake = { ...snake };
            
            const agent = agents[index];
            const move = agent.getMove(state, index);

            // check if the move is valid, apply it if so
            if (isValidTurn(snake.direction, move)) {
                newSnake.direction = move;
            } else {
                console.warn(`Invalid move: ${move} for snake ${index}`);
            }
            
            // get next head position
            let newHead: Point = { ...newSnake.body[0] };
            switch (newSnake.direction) {
                case "up":
                    newHead.y -= 1;
                    break;
                case "down":
                    newHead.y += 1;
                    break;
                case "left":
                    newHead.x -= 1;
                    break;
                case "right":
                    newHead.x += 1;
                    break;
            }

            // check if the next head position is valid and not colliding with self
            if (isValidPosition(newHead) && !isColliding(newHead, newSnake.body)) {
                // set the new head position
                newSnake.body.unshift(newHead);
            } else {
                // kill it
                newSnake.alive = false;
            }

            // if the snake eats food, skip the tail removal
            // otherwise, remove the tail
            const foodIndex = newFoods.findIndex((food) => food.x === newHead.x && food.y === newHead.y);
            if (foodIndex !== -1) {
                // remove the food from the list
                newFoods.splice(foodIndex, 1);
                // add a new food
                newFoods.push(getNextFoodPosition(state.snakes));
            } else {
                // remove the tail
                newSnake.body.pop();
            }

            return newSnake;
        });

        // once all snakes have moved, check for collisions between snakes
        for (let i = 0; i < newSnakes.length; i++) {
            const snakeA = newSnakes[i];
            // skip dead snakes
            if (!snakeA.alive) continue;

            for (let j = 0; j < newSnakes.length; j++) {
                const snakeB = newSnakes[j];
                // already checked self collision, skip dead snakes
                if (i === j || !snakeB.alive) continue;

                if (isColliding(snakeA.body[0], snakeB.body)) {
                    snakeA.alive = false;
                }
                if (isColliding(snakeB.body[0], snakeA.body)) {
                    snakeB.alive = false;
                }
            }
        }

        // return new state
        return {
            ...state,
            snakes: newSnakes,
            foods: newFoods,
            steps: state.steps + 1,
        }
    }

    function isColliding(head: Point, body: Point[]): boolean {
        return body.some((segment) => segment.x === head.x && segment.y === head.y);
    }


    function isValidPosition(position: Point): boolean {
        return (
            position.x >= 0 &&
            position.x < BOARD_SIZE &&
            position.y >= 0 &&
            position.y < BOARD_SIZE
        );
    }


    function isValidTurn(last: Direction, next: Direction): boolean {
        // prevent 180 degree turns
        const opposites = {
            up: "down",
            down: "up",
            left: "right",
            right: "left",
        }

        return last !== opposites[next];
    }


    function getNextFoodPosition(snakes: Snake[]): Point {
        // get set of occupied positions
        // store them as x,y strings instead of pointers to Point objects
        // to avoid reference issues
        const occupied = new Set<string>();
        
        snakes.forEach((snake) => {
            snake.body.forEach((segment) => {
                occupied.add(`${segment.x},${segment.y}`);
            });
        });

        const choices = Array.from({ length: BOARD_SIZE * BOARD_SIZE }, (_, i) => ({
            x: i % BOARD_SIZE,
            y: Math.floor(i / BOARD_SIZE),
        }));

        // filter out occupied positions
        const availablePositions = choices.filter((pos) => {
            const key = `${pos.x},${pos.y}`;
            return !occupied.has(key);
        });

        // if no available positions, throw an error
        if (availablePositions.length === 0) {
            throw new Error("No available positions for food");
        }

        // pick a random position from available positions
        const randomIndex = Math.floor(Math.random() * availablePositions.length);
        return availablePositions[randomIndex];
    }


    function drawCheckeredBackground(ctx: CanvasRenderingContext2D) {
        for (let i = 0; i < BOARD_SIZE; i++) {
            for (let j = 0; j < BOARD_SIZE; j++) {
                ctx.fillStyle = (i + j) % 2 === 0 ? "#eee" : "#fff";
                ctx.fillRect(i * CELL_SIZE, j * CELL_SIZE, CELL_SIZE, CELL_SIZE);
            }
        }
    }

    function drawSnake(ctx: CanvasRenderingContext2D, snake: Snake, index: number) {
        // set color based on snake index
        const colors = ["green", "blue", "purple", "hotpink", "orange"];
        ctx.fillStyle = colors[index % colors.length];

        // draw snake corpse as gray
        if (!snake.alive) {
            ctx.fillStyle = "gray";
        }

        snake.body.forEach((segment) => {
            ctx.fillRect(segment.x * CELL_SIZE, segment.y * CELL_SIZE, CELL_SIZE, CELL_SIZE);
        });
    }

    function drawFood(ctx: CanvasRenderingContext2D, food: Point) {
        ctx.fillStyle = "red";
        ctx.fillRect(food.x * CELL_SIZE, food.y * CELL_SIZE, CELL_SIZE, CELL_SIZE);
    }

    function draw() {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        // clear the canvas
        ctx.clearRect(0, 0, BOARD_WIDTH, BOARD_HEIGHT);

        // draw the checkered background
        drawCheckeredBackground(ctx);

        // draw the snakes
        gameState.snakes.forEach((snake, index) => {
            drawSnake(ctx, snake, index);
        });

        // draw the foods
        gameState.foods.forEach((food) => {
            drawFood(ctx, food);
        });
    }

    return (
        <canvas 
            ref={canvasRef}
            width={BOARD_WIDTH}
            height={BOARD_HEIGHT}
        />
    )
}