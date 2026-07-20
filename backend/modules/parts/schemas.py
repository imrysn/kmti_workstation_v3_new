from pydantic import BaseModel

class CreateProjectRequest(BaseModel):
    name: str
    root_path: str
    category: str = "PROJECTS"

class CreateFolderRequest(BaseModel):
    project_name: str
    base_path: str = ""
