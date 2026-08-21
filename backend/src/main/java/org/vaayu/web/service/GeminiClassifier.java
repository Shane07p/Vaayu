package org.vaayu.web.service;

/** External citizen-photo classification boundary. */
public interface GeminiClassifier {
    GeminiAssessment classify(String photoUri);
}
