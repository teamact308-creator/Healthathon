#!/usr/bin/env python

"""The setup script."""

from setuptools import find_packages, setup

with open("README.md") as readme_file:
    readme = readme_file.read()

requirements = [
    "celery",
    "django",
    "djangorestframework",
    "django-environ",
    "django-filter",
    "requests>=2.32,<3",
]

setup(
    author="Team Act",
    python_requires=">=3.13",
    classifiers=[
        "Development Status :: 2 - Pre-Alpha",
        "Intended Audience :: Developers",
        "License :: OSI Approved :: MIT License",
        "Natural Language :: English",
        "Programming Language :: Python :: 3",
        "Programming Language :: Python :: 3.13",
    ],
    description="WholeCare Diabetes plugin for CARE",
    install_requires=requirements,
    license="MIT license",
    long_description=readme,
    long_description_content_type="text/markdown",
    include_package_data=True,
    keywords="care_wholecare",
    name="care_wholecare",
    packages=find_packages(include=["care_wholecare", "care_wholecare.*"]),
    url="https://github.com/teamact308-creator/Healthathon/tree/main/integrations/care",
    version="0.2.0",
    zip_safe=False,
)
