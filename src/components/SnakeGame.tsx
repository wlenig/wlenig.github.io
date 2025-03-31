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
        const interval = setInterval(step, STEP_INTERVAL);
        return () => clearInterval(interval);
    }, [gameState]);

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
        }

        agents.forEach((agent) => {
            agent.setup && agent.setup();
        });

        const initialSnakes: Snake[] = agents.map((_, index) => ({
            body: [
                { 
                    x: Math.floor(BOARD_SIZE / (agents.length + 1)) * (index + 1), 
                    y: Math.floor(BOARD_SIZE / 2)
                },
            ],
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
    }
    
    function step() {
        // update snakes
        const newSnakes = gameState.snakes.map((snake, index) => {
            // do not update dead snakes
            if (!snake.alive) return snake;

            const newSnake = { ...snake };
            
            const agent = agents[index];
            const move = agent.getMove(gameState, index);

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

            // check if the next head position is valid
            if (isValidPosition(newHead)) {
                // set the new head position
                newSnake.body.unshift(newHead);
                newSnake.body.pop();
            } else {
                // snake hit the wall, mark it as dead
                newSnake.alive = false;
            }

            return newSnake;
        });

        const newFoods = [...gameState.foods];

        // if snake head is on food, grow the snake
        for (const snake of newSnakes) {
            const head = snake.body[0];
            
            // find the food this snake is on
            const foodIndex = gameState.foods.findIndex(
                (food) => food.x === head.x && food.y === head.y
            );

            if (foodIndex === -1) continue;

            // grow the snake
            snake.body.push({ ...snake.body[snake.body.length - 1] });
            snake.body[snake.body.length - 1].x = head.x;
            snake.body[snake.body.length - 1].y = head.y;

            // remove the food
            newFoods.splice(foodIndex, 1);
            // add a new food
            newFoods.push(getNextFoodPosition(gameState.snakes));
        }

        setGameState((prevState) => ({
            ...prevState,
            foods: newFoods,
            snakes: newSnakes,
            steps: prevState.steps + 1,
        }));
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
        const occupied = new Set<Point>();
        
        snakes.forEach((snake) => {
            snake.body.forEach((segment) => {
                occupied.add(segment);
            });
        });

        // find a random empty position
        let position: Point;
        do {
            position = {
                x: Math.floor(Math.random() * BOARD_SIZE),
                y: Math.floor(Math.random() * BOARD_SIZE),
            };
        } while (occupied.has(position));

        return position;
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
        // TODO: Use hue rotation for colors
        switch (index) {
            case 0:
                ctx.fillStyle = "green";
                break;
            case 1:
                ctx.fillStyle = "blue";
                break;
            case 2:
                ctx.fillStyle = "purple";
                break;
        }

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

        // draw the foods
        gameState.foods.forEach((food) => {
            drawFood(ctx, food);
        });

        // draw the snakes
        gameState.snakes.forEach((snake, index) => {
            drawSnake(ctx, snake, index);
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