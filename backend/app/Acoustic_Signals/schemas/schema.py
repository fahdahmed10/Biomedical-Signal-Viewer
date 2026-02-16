from pydantic import BaseModel, Field
from typing import Optional
































# class GenerationInput(BaseModel):
#     velocity: float = Field(..., description="Velocity of the source (m/s)")
#     frequency: float = Field(..., gt=0, description="Source frequency (Hz)")
#     duration: float = Field(..., gt=0, description="Signal duration (seconds)")
#     num_points_per_second: int = Field(default=44000, gt=0)


# class GeneratedSignal(BaseModel):
#     Signal : list
#     Time : list


