from fastapi import FastAPI

app = FastAPI()
score = {"value": 0}

@app.post("/upvote")
def upvote():
    score["value"] += 1
    return {"score": score["value"]}

@app.post("/downvote")
def downvote():
    score["value"] -= 1
    return {"score": score["value"]}

@app.get("/score")
def get_score():
    return {"score": score["value"]}
